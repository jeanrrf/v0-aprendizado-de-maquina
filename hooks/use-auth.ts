import { useState, useEffect } from "react"
import {
  signInWithPopup,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { conversationCache } from "@/lib/cache/lru-conversation-cache"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
    } catch (err) {
      console.error("Sign-Out Error:", err)
    }
  }

  return { user, error, setError, handleSignIn, handleSignOut }
}
