import { useState, useEffect, useRef } from "react"
import { User } from "firebase/auth"
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db, handleFirestoreError, OperationType } from "@/lib/firebase"
import { ChatAttachment } from "@/components/chat/chat-input"
import { sanitizeAttachmentForFirestore } from "@/lib/multimodal/artifacts"
import { conversationCache } from "@/lib/cache/lru-conversation-cache"
import { NimParameters } from "@/lib/nim-config"

export interface MessageItem {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "streaming" | "completed" | "error"
  attachments?: ChatAttachment[]
}

async function parseSseStream(
  response: Response,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Não foi possível inicializar o leitor de stream SSE.")

  const decoder = new TextDecoder("utf-8")
  let accumulated = ""
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(":")) continue
      if (trimmed === "data: [DONE]") continue

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6)
        try {
          const parsed = JSON.parse(jsonStr)
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === "string") {
            accumulated += delta
            onChunk(accumulated)
          }
        } catch {
          // Ignora JSON parcial
        }
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
      try {
        const parsed = JSON.parse(trimmed.slice(6))
        const delta = parsed.choices?.[0]?.delta?.content
        if (typeof delta === "string") {
          accumulated += delta
          onChunk(accumulated)
        }
      } catch {
        // Ignora JSON parcial
      }
    }
  }

  return accumulated
}

export function useChat(
  user: User | null,
  activeConversationId: string,
  modelName: string,
  nimParams: NimParameters,
  thinkingMode: string,
  isMounted: React.MutableRefObject<boolean>
) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [activeStream, setActiveStream] = useState<{ conversationId: string; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!user || !activeConversationId || activeConversationId === "default") {
      setMessages([])
      return
    }

    const cached = conversationCache.get(activeConversationId)
    if (cached && cached.length > 0) {
      setMessages(cached)
    } else {
      setMessages([])
    }

    const msgPath = `users/${user.uid}/conversations/${activeConversationId}/messages`
    const messagesRef = collection(db, "users", user.uid, "conversations", activeConversationId, "messages")
    const q = query(messagesRef, orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              role: d.data().role,
              content: d.data().content,
              status: d.data().status || "completed",
              attachments: d.data().attachments,
            } as MessageItem)
        )
        if (isMounted.current) {
          setMessages(msgs)
          conversationCache.set(activeConversationId, msgs, user.uid)
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, msgPath)
      }
    )

    return () => unsubscribe()
  }, [user, activeConversationId])

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      setActiveStream(null)
      setError("Processamento interrompido pelo operador.")
    }
  }

  const sendMessage = async (messageText: string, attachments: ChatAttachment[] = []) => {
    if (!isMounted.current) return
    setError(undefined)

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()

    const conversationHistory = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        mimeType: a.mimeType,
        url: a.url,
        content: a.content,
      })),
    }))

    if (!user) {
      setIsLoading(true)
      const targetConvId = "default"
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: messageText, attachments, status: "completed" },
      ])

      if (nimParams.stream) {
        if (isMounted.current) {
          setActiveStream({ conversationId: targetConvId, text: "" })
        }

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({
              message: messageText,
              attachments,
              model: modelName,
              stream: true,
              temperature: nimParams.temperature,
              top_p: nimParams.top_p,
              max_tokens: nimParams.max_tokens,
              history: conversationHistory,
              thinking_mode: thinkingMode,
            }),
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error || `Erro NIM ${res.status}`)
          }

          const fullText = await parseSseStream(res, (currentText) => {
            if (isMounted.current) {
              setActiveStream((curr) =>
                curr && curr.conversationId === targetConvId
                  ? { ...curr, text: currentText }
                  : curr
              )
            }
          })

          if (isMounted.current) {
            setMessages((prev) => [
              ...prev,
              { id: assistantMessageId, role: "assistant", content: fullText, status: "completed" },
            ])
          }
        } catch (cause) {
          if (isMounted.current) {
            setError(cause instanceof Error ? cause.message : "Erro de conexão com a NVIDIA.")
          }
        } finally {
          if (isMounted.current) {
            setActiveStream(null)
            setIsLoading(false)
          }
        }
        return
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: false,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            history: conversationHistory,
            thinking_mode: thinkingMode,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.content) throw new Error(data.error || "Erro ao responder.")
        if (isMounted.current) {
          setMessages((prev) => [
            ...prev,
            { id: assistantMessageId, role: "assistant", content: data.content, status: "completed" },
          ])
        }
      } catch (cause) {
        if (isMounted.current) {
          setError(cause instanceof Error ? cause.message : "Erro desconhecido.")
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // Persisted mode
    const targetConversationId = activeConversationId
    const convRef = doc(db, "users", user.uid, "conversations", targetConversationId)
    const userMsgRef = doc(db, "users", user.uid, "conversations", targetConversationId, "messages", userMessageId)
    const assistantMsgRef = doc(db, "users", user.uid, "conversations", targetConversationId, "messages", assistantMessageId)

    const isFirstMsg = messages.length === 0
    const previewText = messageText || (attachments[0]?.name ? `[Anexo: ${attachments[0].name}]` : "Nova conversa")
    const newTitle = isFirstMsg ? previewText.slice(0, 45) : undefined

    setIsLoading(true)

    try {
      const userBatch = writeBatch(db)
      userBatch.set(userMsgRef, {
        id: userMessageId,
        role: "user",
        content: messageText,
        status: "completed",
        attachments: attachments.map(sanitizeAttachmentForFirestore),
        createdAt: serverTimestamp(),
      })

      userBatch.set(
        convRef,
        {
          ...(newTitle ? { title: newTitle } : {}),
          preview: previewText.slice(0, 80),
          model: modelName,
          status: nimParams.stream ? "streaming" : "idle",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      await userBatch.commit()

      for (const att of attachments) {
        if (!att.id.startsWith("cloud-")) {
          const sanitized = sanitizeAttachmentForFirestore(att)
          addDoc(collection(db, "users", user.uid, "files"), {
            name: sanitized.name,
            type: sanitized.type,
            mimeType: sanitized.mimeType,
            sizeBytes: sanitized.sizeBytes || 0,
            sizeFormatted: sanitized.sizeFormatted,
            content: sanitized.content || sanitized.url || null,
            createdAt: serverTimestamp(),
          }).catch((e) => console.warn("Could not mirror file:", e))
        }
      }

      if (nimParams.stream) {
        if (isMounted.current) {
          setActiveStream({ conversationId: targetConversationId, text: "" })
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: true,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            history: conversationHistory,
            thinking_mode: thinkingMode,
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `Erro NIM ${response.status}`)
        }

        const fullText = await parseSseStream(response, (currentText) => {
          if (isMounted.current) {
            setActiveStream((curr) =>
              curr && curr.conversationId === targetConversationId
                ? { ...curr, text: currentText }
                : curr
            )
          }
        })

        const assistantBatch = writeBatch(db)
        assistantBatch.set(assistantMsgRef, {
          id: assistantMessageId,
          role: "assistant",
          content: fullText,
          status: "completed",
          createdAt: serverTimestamp(),
        })

        assistantBatch.set(
          convRef,
          {
            preview: fullText.slice(0, 80),
            model: modelName,
            status: "completed",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        await assistantBatch.commit()
        if (isMounted.current) {
          setActiveStream((curr) => (curr?.conversationId === targetConversationId ? null : curr))
        }
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: false,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            history: conversationHistory,
            thinking_mode: thinkingMode,
          }),
        })

        const data = await response.json()
        if (!response.ok || !data.content) throw new Error(data.error ?? "Não foi possível obter uma resposta da IA.")

        const assistantBatch = writeBatch(db)
        assistantBatch.set(assistantMsgRef, {
          id: assistantMessageId,
          role: "assistant",
          content: data.content,
          status: "completed",
          createdAt: serverTimestamp(),
        })

        assistantBatch.set(
          convRef,
          {
            preview: data.content.slice(0, 80),
            model: data.model || modelName,
            status: "completed",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        await assistantBatch.commit()
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      if (isMounted.current) {
        setError(cause instanceof Error ? cause.message : "Ocorreu um erro ao processar sua mensagem.")
      }
      try {
        await setDoc(convRef, { status: "error", updatedAt: serverTimestamp() }, { merge: true })
      } catch {}
      if (isMounted.current) {
        setActiveStream((curr) => (curr?.conversationId === targetConversationId ? null : curr))
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }

  return {
    messages,
    activeStream,
    isLoading,
    error,
    setError,
    sendMessage,
    handleStopProcessing,
    setMessages,
  }
}
