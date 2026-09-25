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
import { ChatInput } from "@/components/chat/chat-input"
import { MenuScreen, FirestoreConversation } from "@/components/chat/menu-screen"
import { SearchScreen } from "@/components/chat/search-screen"
import { FilesScreen } from "@/components/chat/files-screen"
import { SettingsScreen } from "@/components/chat/settings-screen"
import { ResonanceField } from "@/components/ainex/resonance-field"

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

  return accumulated
}

export default function ChatPage() {
  const [active, setActive] = useState("chat")
  const [user, setUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<FirestoreConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>("default")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [modelName, setModelName] = useState("meta/llama-3.2-11b-vision-instruct")
  const [nimParams, setNimParams] = useState<NimParameters>(DEFAULT_NIM_PARAMS)

  // Monitor Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
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

  // Listen to Messages of Active Conversation in Firestore
  useEffect(() => {
    if (!user || !activeConversationId || activeConversationId === "default") {
      return
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
            } as MessageItem)
        )
        setMessages(msgs)
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
      const convRef = collection(db, "users", user.uid, "conversations")
      const newDoc = await addDoc(convRef, {
        title: "Nova conversa",
        preview: "Iniciada agora...",
        model: modelName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setActiveConversationId(newDoc.id)
      setMessages([])
      setActive("chat")
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations`)
    }
  }

  const handleDeleteConversation = async (convId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, "users", user.uid, "conversations", convId))
      if (activeConversationId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId)
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id)
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
    setActiveConversationId(convId)
    setActive("chat")
  }

  async function sendMessage(messageText: string) {
    setError(undefined)
    setIsLoading(true)

    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()

    // Histórico de contexto para a NVIDIA NIM
    const conversationHistory = messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // MODO VISITANTE (sem Firestore)
    if (!user) {
      setMessages((prev) => [...prev, { id: userMessageId, role: "user", content: messageText }])

      if (nimParams.stream) {
        setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }])

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: messageText,
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

          await parseSseStream(res, (currentText) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessageId ? { ...m, content: currentText } : m))
            )
          })
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Erro de conexão com a NVIDIA.")
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
        } finally {
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
          { id: assistantMessageId, role: "assistant", content: data.content },
        ])
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro desconhecido.")
      } finally {
        setIsLoading(false)
      }
      return
    }

    // MODO PERSISTIDO NO FIRESTORE
    const conversationId = activeConversationId === "default" ? "default" : activeConversationId

    try {
      const convRef = doc(db, "users", user.uid, "conversations", conversationId)
      const isFirstMsg = messages.length === 0
      const newTitle = isFirstMsg ? messageText.slice(0, 45) : undefined

      await setDoc(
        convRef,
        {
          ...(newTitle ? { title: newTitle } : {}),
          preview: messageText.slice(0, 80),
          model: modelName,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      const messagesRef = collection(db, "users", user.uid, "conversations", conversationId, "messages")
      await addDoc(messagesRef, {
        role: "user",
        content: messageText,
        createdAt: serverTimestamp(),
      })

      if (nimParams.stream) {
        // Inicializa placeholder para renderização token-a-token
        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: "" },
        ])

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
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
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, content: currentText } : m))
          )
        })

        // Persiste a resposta final no Firestore
        await addDoc(messagesRef, {
          role: "assistant",
          content: fullText,
          createdAt: serverTimestamp(),
        })

        await setDoc(
          convRef,
          {
            preview: fullText.slice(0, 80),
            model: modelName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
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

        await addDoc(messagesRef, {
          role: "assistant",
          content: data.content,
          createdAt: serverTimestamp(),
        })

        await setDoc(
          convRef,
          {
            preview: data.content.slice(0, 80),
            model: data.model || modelName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      }
    } catch (cause) {
      console.error("Chat & Firestore error:", cause)
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro ao processar sua mensagem.")
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

        <main className="flex flex-1 flex-col overflow-hidden">
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
            className="flex flex-1 flex-col overflow-hidden duration-200 animate-in fade-in-50"
          >
            {active === "chat" && (
              <>
                <ChatMessages messages={messages} error={error} />
                <ChatInput onSubmit={sendMessage} isLoading={isLoading} />
              </>
            )}
            {active === "ainex" && <ResonanceField />}
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
            {active === "search" && <SearchScreen />}
            {active === "files" && <FilesScreen />}
            {active === "settings" && (
              <SettingsScreen
                currentModel={modelName}
                onSelectModel={setModelName}
                nimParams={nimParams}
                onChangeNimParams={setNimParams}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
