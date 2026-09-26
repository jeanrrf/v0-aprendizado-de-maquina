"use client"

import { useState, useEffect, useRef, memo } from "react"
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
import { LiveAPIOverlay } from "@/components/chat/live-api-overlay"
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
  
  // Teste de interação visual direto no topo
  const [clickCount, setClickCount] = useState(0)

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error("GLOBAL_RUNTIME_ERROR:", e.message, e.error);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<FirestoreConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>("default")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [activeStream, setActiveStream] = useState<{ conversationId: string; text: string } | null>(null)
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [modelName, setModelName] = useState("z-ai/glm-5.3-flash")
  const [nimParams, setNimParams] = useState<NimParameters>(DEFAULT_NIM_PARAMS)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])
  
  const [thinkingMode, setThinkingMode] = useState<"turbo" | "balanced" | "omni">("balanced")
  const [isLiveOpen, setIsLiveOpen] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
      setActiveStream(null)
      setError("Processamento interrompido pelo operador.")
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted.current) return
      setUser(currentUser)
      if (currentUser) {
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
        if (!isMounted.current) return
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
        if (!isMounted.current) return
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
    } catch (err: any) {
      console.warn("Google Sign-In caught error:", err?.code, err?.message)
      try {
        await signInAnonymously(auth)
        setError("Conectado como Operador AINEX (Firestore sincronizado em nuvem).")
        return
      } catch (anonErr) {
        console.warn("Anonymous sign-in failed:", anonErr)
      }
      setError(
        err?.code === "auth/popup-blocked"
          ? "O navegador bloqueou a janela de login no iframe. Permita popups ou abra a aplicação em aba dedicada."
          : err?.code === "auth/unauthorized-domain"
          ? "Domínio do preview requer autorização no Firebase Console."
          : "Não foi possível abrir o login do Google."
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
      const cached = conversationCache.get(convId)
      setMessages(cached || [])
      setActiveConversationId(convId)
    }
    setActive("chat")
  }

  async function sendMessage(messageText: string, attachments: ChatAttachment[] = []) {
    if (!isMounted.current) return
    setError(undefined)

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const userMessageId = `${Date.now()}-user`
    const assistantMessageId = `${Date.now()}-assistant`

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
        setActiveStream({ conversationId: targetConvId, text: "" })
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
              setActiveStream((curr) => curr && curr.conversationId === targetConvId ? { ...curr, text: currentText } : curr)
            }
          })
          if (isMounted.current) {
            setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: fullText, status: "completed" }])
          }
        } catch (cause) {
          if (isMounted.current) setError(cause instanceof Error ? cause.message : "Erro de conexão.")
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
          setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: data.content, status: "completed" }])
        }
      } catch (cause) {
        if (isMounted.current) setError(cause instanceof Error ? cause.message : "Erro desconhecido.")
      } finally {
        if (isMounted.current) setIsLoading(false)
      }
      return
    }

    let targetConversationId = activeConversationId
    if (!targetConversationId || targetConversationId === "default") {
      const newConvRef = doc(collection(db, "users", user.uid, "conversations"))
      targetConversationId = newConvRef.id
      setActiveConversationId(targetConversationId)
    }

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
          }).catch(() => {})
        }
      }

      if (nimParams.stream) {
        if (isMounted.current) setActiveStream({ conversationId: targetConversationId, text: "" })
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
            setActiveStream((curr) => curr && curr.conversationId === targetConversationId ? { ...curr, text: currentText } : curr)
          }
        })
        const assistantBatch = writeBatch(db)
        assistantBatch.set(assistantMsgRef, { id: assistantMessageId, role: "assistant", content: fullText, status: "completed", createdAt: serverTimestamp() })
        assistantBatch.set(convRef, { preview: fullText.slice(0, 80), model: modelName, status: "completed", updatedAt: serverTimestamp() }, { merge: true })
        await assistantBatch.commit()
        if (isMounted.current) setActiveStream((curr) => curr?.conversationId === targetConversationId ? null : curr)
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
        if (!response.ok || !data.content) throw new Error(data.error ?? "Erro ao responder.")
        const assistantBatch = writeBatch(db)
        assistantBatch.set(assistantMsgRef, { id: assistantMessageId, role: "assistant", content: data.content, status: "completed", createdAt: serverTimestamp() })
        assistantBatch.set(convRef, { preview: data.content.slice(0, 80), model: data.model || modelName, status: "completed", updatedAt: serverTimestamp() }, { merge: true })
        await assistantBatch.commit()
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      if (isMounted.current) setError(cause instanceof Error ? cause.message : "Erro no processamento.")
      try {
        await setDoc(convRef, { status: "error", updatedAt: serverTimestamp() }, { merge: true })
      } catch {}
      if (isMounted.current) setActiveStream((curr) => curr?.conversationId === targetConversationId ? null : curr)
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        {/* BOTÃO DE TESTE DE INTERAÇÃO GLOBAL */}
        <button 
          onClick={() => {
            console.log("GLOBAL_TEST_CLICK");
            setClickCount(c => c + 1);
          }}
          className="fixed top-20 left-20 z-[999] bg-red-600 text-white p-4 rounded-full shadow-2xl font-bold animate-bounce"
        >
          CLIQUE PARA TESTAR ({clickCount})
        </button>

        <Sidebar activeItem={active} onSelect={setActive} user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />

        <main className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <ChatHeader
            title={titles[active] || "AINEX"}
            showModelInfo={active === "chat"}
            modelName={modelName}
            onSelectModel={setModelName}
            onNewChat={handleNewConversation}
            onStartLive={() => setIsLiveOpen(true)}
            user={user}
            onSignIn={handleSignIn}
          />

          <div key={active} className="flex flex-1 min-h-0 flex-col overflow-hidden">
            {active === "chat" && (
              <div className="flex flex-1 flex-grow min-h-0 flex-col overflow-hidden">
                <ChatMessages
                  messages={messages}
                  error={error}
                  isLoading={isLoading && activeStream?.conversationId === activeConversationId}
                  streamingText={activeStream?.conversationId === activeConversationId ? activeStream.text : null}
                  modelName={modelName}
                  onSelectPrompt={(p) => sendMessage(p)}
                />
                <ChatInput onSubmit={sendMessage} isLoading={isLoading} user={user} thinkingMode={thinkingMode} onThinkingModeChange={setThinkingMode} onStop={handleStopProcessing} />
              </div>
            )}
            {active === "ainex" && (
              <div className="flex flex-1 items-center justify-center p-10 text-center">
                <div className="max-w-md space-y-4">
                  <h2 className="text-2xl font-bold">AINEX Engine</h2>
                  <p className="text-muted-foreground">O campo de ressonância foi temporariamente desativado para diagnóstico de hardware.</p>
                  <button onClick={() => console.log("DIAGNOSTIC_CLICK")} className="px-4 py-2 bg-primary rounded-lg text-white">Teste de Interação</button>
                </div>
              </div>
            )}
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
            {active === "search" && <SearchScreen user={user} onSignIn={handleSignIn} onSelectConversation={handleSelectConversation} />}
            {active === "files" && <FilesScreen user={user} onSignIn={handleSignIn} />}
            {active === "settings" && <SettingsScreen currentModel={modelName} onSelectModel={setModelName} nimParams={nimParams} onChangeNimParams={setNimParams} user={user} onSignIn={handleSignIn} />}
          </div>
        </main>
      </div>
    </div>
  )
}
