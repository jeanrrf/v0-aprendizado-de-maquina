"use client"

import { useState, useEffect } from "react"
import {
  signInWithPopup,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth"
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase"
import { NimParameters, DEFAULT_NIM_PARAMS } from "@/lib/nim-config"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput, ChatAttachment } from "@/components/chat/chat-input"
import { MenuScreen, FirestoreConversation } from "@/components/chat/menu-screen"
import { SearchScreen } from "@/components/chat/search-screen"
import { FilesScreen } from "@/components/chat/files-screen"
import { SettingsScreen } from "@/components/chat/settings-screen"
import { ResonanceField } from "@/components/ainex/resonance-field"
import { sanitizeAttachmentForFirestore } from "@/lib/multimodal/artifacts"
import { conversationCache } from "@/lib/cache/lru-conversation-cache"

const titles: Record<string, string> = {
  chat: "Chat com AINEX",
  ainex: "AINEX · Campo de Ressonância",
  menu: "Conversas",
  search: "Pesquisar",
  files: "Arquivos",
  settings: "Configurações",
}

interface MessageItem {
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

export default function ChatPage() {
  const [active, setActive] = useState("chat")
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<FirestoreConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>("default")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [activeStream, setActiveStream] = useState<{ conversationId: string; text: string } | null>(null)
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [modelName, setModelName] = useState("nvidia/nemotron-3-ultra-550b-a55b")
  const [nimParams, setNimParams] = useState<NimParameters>(DEFAULT_NIM_PARAMS)

  // Monitor Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Hidratação prévia do cache LRU local (0ms warm boot)
        conversationCache.hydrateFromStorage(currentUser.uid)

        const userRef = doc(db, "users", currentUser.uid)
        try {
          await setDoc(
            userRef,
            {
              email: currentUser.email || "operador@ainex.local",
              displayName: currentUser.displayName || (currentUser.isAnonymous ? "Operador AINEX" : "Usuário"),
              photoURL: currentUser.photoURL || "",
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          )
        } catch (err) {
          console.warn("Could not save user profile to Firestore:", err)
        }
      }
    })
    return () => unsubscribe()
  }, [])

  // Listen to User Conversations in Firestore
  useEffect(() => {
    if (!user) {
      setConversations([])
      return
    }

    const convPath = `users/${user.uid}/conversations`
    const conversationsRef = collection(db, "users", user.uid, "conversations")
    const q = query(conversationsRef, orderBy("updatedAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FirestoreConversation[] = snapshot.docs.map((d) => ({
          id: d.id,
          title: d.data().title || "Conversa sem título",
          preview: d.data().preview || "",
          model: d.data().model || "",
          status: d.data().status || "idle",
          updatedAt: d.data().updatedAt,
        }))
        setConversations(list)

        setActiveConversationId((curr) => {
          if (list.length > 0 && (!curr || !list.some((c) => c.id === curr))) {
            return list[0].id
          }
          return curr
        })
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, convPath)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Listen to Messages of Active Conversation in Firestore with LRU Cache Layer
  useEffect(() => {
    if (!user || !activeConversationId || activeConversationId === "default") {
      setMessages([])
      return
    }

    // Camada de Cache LRU: Tenta recuperar o histórico em memória antes da resposta de rede (0ms render)
    const cached = conversationCache.get(activeConversationId)
    if (cached && cached.length > 0) {
      setMessages(cached)
    } else {
      setMessages([])
    }

    const msgPath = `users/${user.uid}/conversations/${activeConversationId}/messages`
    const messagesRef = collection(
      db,
      "users",
      user.uid,
      "conversations",
      activeConversationId,
      "messages"
    )
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
        // Atualiza estado e sincroniza a camada LRU
        setMessages(msgs)
        conversationCache.set(activeConversationId, msgs, user.uid)
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, msgPath)
      }
    )

    return () => unsubscribe()
  }, [user, activeConversationId])

  const handleSignIn = async () => {
    setError(undefined)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      await signInWithPopup(auth, provider)
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string }
      console.warn("Google Sign-In caught error:", authErr?.code, authErr?.message)

      try {
        await signInAnonymously(auth)
        setError("Conectado como Operador AINEX (Firestore sincronizado em nuvem).")
        return
      } catch (anonErr) {
        console.warn("Anonymous sign-in failed:", anonErr)
      }

      setError(
        authErr?.code === "auth/popup-blocked"
          ? "O navegador bloqueou a janela de login no iframe. Permita popups ou abra a aplicação em aba dedicada."
          : authErr?.code === "auth/unauthorized-domain"
          ? "Domínio do preview requer autorização no Firebase Console. Use o chat normalmente como visitante ou operador."
          : "Não foi possível abrir o login do Google no iframe do preview."
      )
    }
  }

  const handleSignOut = async () => {
    try {
      if (user?.uid) {
        conversationCache.clear(user.uid)
      }
      await signOut(auth)
      setMessages([])
      setConversations([])
      setActiveConversationId("default")
    } catch (err) {
      console.error("Sign-Out Error:", err)
    }
  }

  const handleNewConversation = async () => {
    if (!user) {
      handleSignIn()
      return
    }

    try {
      const newDoc = doc(collection(db, "users", user.uid, "conversations"))
      const newId = newDoc.id
      await setDoc(newDoc, {
        title: "Nova conversa",
        preview: "Iniciada agora...",
        model: modelName,
        status: "idle",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setMessages([])
      setActiveConversationId(newId)
      setActive("chat")
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations`)
    }
  }

  const handleDeleteConversation = async (convId: string) => {
    if (!user) return
    try {
      conversationCache.delete(convId, user.uid)
      await deleteDoc(doc(db, "users", user.uid, "conversations", convId))
      if (activeConversationId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId)
        if (remaining.length > 0) {
          const nextId = remaining[0].id
          const cached = conversationCache.get(nextId)
          setMessages(cached || [])
          setActiveConversationId(nextId)
        } else {
          setActiveConversationId("default")
          setMessages([])
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/conversations/${convId}`)
    }
  }

  const handleSelectConversation = (convId: string) => {
    if (convId !== activeConversationId) {
      // 0ms instant transition via LRU Cache
      const cached = conversationCache.get(convId)
      if (cached && cached.length > 0) {
        setMessages(cached)
      } else {
        setMessages([])
      }
      setActiveConversationId(convId)
    }
    setActive("chat")
  }

  async function sendMessage(messageText: string, attachments: ChatAttachment[] = []) {
    setError(undefined)

    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()

    // Histórico de contexto para a NVIDIA NIM (preservando anexos visuais e documentais)
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

    // MODO VISITANTE (sem login)
    if (!user) {
      setIsLoading(true)
      const targetConvId = "default"
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: messageText, attachments, status: "completed" },
      ])

      if (nimParams.stream) {
        setActiveStream({ conversationId: targetConvId, text: "" })

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: messageText,
              attachments,
              model: modelName,
              stream: true,
              temperature: nimParams.temperature,
              top_p: nimParams.top_p,
              max_tokens: nimParams.max_tokens,
              frequency_penalty: nimParams.frequency_penalty,
              presence_penalty: nimParams.presence_penalty,
              history: conversationHistory,
            }),
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error || `Erro NIM ${res.status}`)
          }

          const fullText = await parseSseStream(res, (currentText) => {
            setActiveStream((curr) =>
              curr && curr.conversationId === targetConvId
                ? { ...curr, text: currentText }
                : curr
            )
          })

          setMessages((prev) => [
            ...prev,
            { id: assistantMessageId, role: "assistant", content: fullText, status: "completed" },
          ])
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Erro de conexão com a NVIDIA.")
        } finally {
          setActiveStream(null)
          setIsLoading(false)
        }
        return
      }

      // Visitante sem stream
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: false,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            history: conversationHistory,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.content) throw new Error(data.error || "Erro ao responder.")
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: data.content, status: "completed" },
        ])
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro desconhecido.")
      } finally {
        setIsLoading(false)
      }
      return
    }

    // MODO PERSISTIDO NO FIRESTORE (TRANSAÇÃO ATÔMICA COM WRITEBATCH)
    let targetConversationId = activeConversationId
    if (!targetConversationId || targetConversationId === "default") {
      const newConvRef = doc(collection(db, "users", user.uid, "conversations"))
      targetConversationId = newConvRef.id
      setActiveConversationId(targetConversationId)
    }

    const convRef = doc(db, "users", user.uid, "conversations", targetConversationId)
    const userMsgRef = doc(
      db,
      "users",
      user.uid,
      "conversations",
      targetConversationId,
      "messages",
      userMessageId
    )
    const assistantMsgRef = doc(
      db,
      "users",
      user.uid,
      "conversations",
      targetConversationId,
      "messages",
      assistantMessageId
    )

    const isFirstMsg = messages.length === 0
    const previewText =
      messageText || (attachments[0]?.name ? `[Anexo: ${attachments[0].name}]` : "Nova conversa")
    const newTitle = isFirstMsg ? previewText.slice(0, 45) : undefined

    setIsLoading(true)

    try {
      // 1. Gravação ATÔMICA da mensagem do usuário e atualização de estado da conversa
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

      // Espelhamento assíncrono para a biblioteca da aba Arquivos
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
        // Inicializa projeção associada EXCLUSIVAMENTE a este targetConversationId
        setActiveStream({ conversationId: targetConversationId, text: "" })

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: true,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            frequency_penalty: nimParams.frequency_penalty,
            presence_penalty: nimParams.presence_penalty,
            history: conversationHistory,
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `Erro NIM ${response.status}`)
        }

        const fullText = await parseSseStream(response, (currentText) => {
          setActiveStream((curr) =>
            curr && curr.conversationId === targetConversationId
              ? { ...curr, text: currentText }
              : curr
          )
        })

        // 2. Gravação ATÔMICA da resposta final e transição para "completed"
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

        // Libera stream ativo se ainda corresponder a esta conversa
        setActiveStream((curr) => (curr?.conversationId === targetConversationId ? null : curr))
      } else {
        // Modo não-streaming
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            attachments,
            model: modelName,
            stream: false,
            temperature: nimParams.temperature,
            top_p: nimParams.top_p,
            max_tokens: nimParams.max_tokens,
            history: conversationHistory,
          }),
        })

        const data = (await response.json()) as { content?: string; error?: string; model?: string }
        if (!response.ok || !data.content) {
          throw new Error(data.error ?? "Não foi possível obter uma resposta da IA.")
        }

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
      console.error("Chat & Firestore error:", cause)
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro ao processar sua mensagem.")

      // Atualiza status de erro na conversa de forma atômica
      try {
        await setDoc(convRef, { status: "error", updatedAt: serverTimestamp() }, { merge: true })
      } catch {}

      setActiveStream((curr) => (curr?.conversationId === targetConversationId ? null : curr))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Main container */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar
          activeItem={active}
          onSelect={(tabId) => {
            setActive(tabId)
          }}
          user={user}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />

        <main className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <ChatHeader
            title={titles[active] || "AINEX"}
            showModelInfo={active === "chat"}
            modelName={modelName}
            onSelectModel={setModelName}
            user={user}
            onSignIn={handleSignIn}
          />

          <div
            key={active}
            className="flex flex-1 min-h-0 flex-col overflow-hidden duration-200 animate-in fade-in-50"
          >
            {active === "chat" && (
              <div className="flex flex-1 flex-grow min-h-0 flex-col overflow-hidden">
                <ChatMessages
                  messages={messages}
                  error={error}
                  isLoading={isLoading && activeStream?.conversationId === activeConversationId}
                  streamingText={
                    activeStream?.conversationId === activeConversationId
                      ? activeStream.text
                      : null
                  }
                  modelName={modelName}
                  onSelectPrompt={(p) => sendMessage(p)}
                />
                <ChatInput
                  onSubmit={sendMessage}
                  isLoading={isLoading}
                  user={user}
                />
              </div>
            )}
            {active === "ainex" && <ResonanceField user={user} />}
            {active === "menu" && (
              <MenuScreen
                conversations={conversations}
                currentConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                onDeleteConversation={handleDeleteConversation}
                isAuthenticated={!!user}
                onSignIn={handleSignIn}
              />
            )}
            {active === "search" && (
              <SearchScreen
                user={user}
                onSignIn={handleSignIn}
                onSelectConversation={handleSelectConversation}
              />
            )}
            {active === "files" && <FilesScreen user={user} onSignIn={handleSignIn} />}
            {active === "settings" && (
              <SettingsScreen
                currentModel={modelName}
                onSelectModel={setModelName}
                nimParams={nimParams}
                onChangeNimParams={setNimParams}
                user={user}
                onSignIn={handleSignIn}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
