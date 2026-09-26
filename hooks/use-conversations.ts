import { useState, useEffect } from "react"
import { User } from "firebase/auth"
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db, handleFirestoreError, OperationType } from "@/lib/firebase"
import { FirestoreConversation } from "@/components/chat/menu-screen"
import { conversationCache } from "@/lib/cache/lru-conversation-cache"

export function useConversations(user: User | null, modelName: string) {
  const [conversations, setConversations] = useState<FirestoreConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>("default")

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

  const handleNewConversation = async () => {
    if (!user) return null

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
      setActiveConversationId(newId)
      return newId
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations`)
      return null
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
          setActiveConversationId(remaining[0].id)
        } else {
          setActiveConversationId("default")
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/conversations/${convId}`)
    }
  }

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    handleNewConversation,
    handleDeleteConversation,
  }
}
