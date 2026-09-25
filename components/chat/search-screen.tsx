"use client"

import { useState, useEffect } from "react"
import { Search, MessageSquare, FileText, Clock, Trash2, ArrowRight, Sparkles } from "lucide-react"
import { User } from "firebase/auth"
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore"
import { db, handleFirestoreError, OperationType } from "@/lib/firebase"
import { FirestoreConversation } from "./menu-screen"
import { FirestoreFileItem } from "./files-screen"
import { cn } from "@/lib/utils"

interface SearchScreenProps {
  user: User | null
  onSignIn: () => void
  onSelectConversation?: (conversationId: string) => void
}

interface RecentSearchItem {
  id: string
  term: string
}

export function SearchScreen({ user, onSignIn, onSelectConversation }: SearchScreenProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [conversations, setConversations] = useState<FirestoreConversation[]>([])
  const [files, setFiles] = useState<FirestoreFileItem[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])

  // Busca em tempo real das conversas reais no Firestore
  useEffect(() => {
    if (!user) {
      setConversations([])
      setFiles([])
      setRecentSearches([])
      return
    }

    const convPath = `users/${user.uid}/conversations`
    const qConv = query(collection(db, "users", user.uid, "conversations"), orderBy("updatedAt", "desc"))
    const unsubConv = onSnapshot(
      qConv,
      (snap) => {
        setConversations(
          snap.docs.map((d) => ({
            id: d.id,
            title: d.data().title || "Conversa sem título",
            preview: d.data().preview || "",
            model: d.data().model || "",
            updatedAt: d.data().updatedAt,
          }))
        )
      },
      (err) => handleFirestoreError(err, OperationType.LIST, convPath)
    )

    // Busca em tempo real dos arquivos reais no Firestore
    const filesPath = `users/${user.uid}/files`
    const qFiles = query(collection(db, "users", user.uid, "files"), orderBy("createdAt", "desc"))
    const unsubFiles = onSnapshot(
      qFiles,
      (snap) => {
        setFiles(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || "Arquivo",
            type: d.data().type || "doc",
            mimeType: d.data().mimeType || "",
            sizeBytes: d.data().sizeBytes || 0,
            sizeFormatted: d.data().sizeFormatted || "0 KB",
            content: d.data().content,
            createdAt: d.data().createdAt,
          }))
        )
      },
      (err) => handleFirestoreError(err, OperationType.LIST, filesPath)
    )

    // Busca histórico de pesquisas recentes no Firestore
    const searchPath = `users/${user.uid}/searches`
    const qSearch = query(
      collection(db, "users", user.uid, "searches"),
      orderBy("createdAt", "desc"),
      limit(6)
    )
    const unsubSearch = onSnapshot(
      qSearch,
      (snap) => {
        setRecentSearches(
          snap.docs.map((d) => ({
            id: d.id,
            term: d.data().term || "",
          }))
        )
      },
      (err) => handleFirestoreError(err, OperationType.LIST, searchPath)
    )

    return () => {
      unsubConv()
      unsubFiles()
      unsubSearch()
    }
  }, [user])

  // Salva termo de busca no Firestore
  const handleSaveSearchTerm = async (term: string) => {
    const clean = term.trim()
    if (!clean || !user) return

    // Evita duplicatas consecutivas
    if (recentSearches.some((s) => s.term.toLowerCase() === clean.toLowerCase())) return

    try {
      await addDoc(collection(db, "users", user.uid, "searches"), {
        term: clean,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn("Could not save search history:", err)
    }
  }

  const handleDeleteSearchTerm = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    try {
      await deleteDoc(doc(db, "users", user.uid, "searches", id))
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/searches/${id}`)
    }
  }

  // Filtragem real e unificada no Firestore
  const term = searchTerm.toLowerCase().trim()

  const matchingConversations = term
    ? conversations.filter(
        (c) => c.title.toLowerCase().includes(term) || (c.preview && c.preview.toLowerCase().includes(term))
      )
    : []

  const matchingFiles = term
    ? files.filter((f) => f.name.toLowerCase().includes(term))
    : []

  const totalResults = matchingConversations.length + matchingFiles.length

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Search className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Pesquisa Unificada no Firestore</h2>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta para pesquisar em tempo real em todas as suas conversas gravadas e arquivos armazenados na nuvem.
          </p>
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:opacity-90"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-xl font-semibold text-foreground">Pesquisar no Sistema</h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Indexação direta em tempo real de suas conversas e arquivos no Firestore
        </p>

        {/* Barra de Pesquisa */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-inner transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveSearchTerm(searchTerm)
            }}
            placeholder="Pesquise por palavras-chave em conversas ou arquivos..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Termos Recentes Reais do Banco de Dados */}
        {!searchTerm && recentSearches.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Pesquisas salvas no seu perfil</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSearchTerm(s.term)}
                  className="group flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <span>{s.term}</span>
                  <button
                    onClick={(e) => handleDeleteSearchTerm(s.id, e)}
                    className="opacity-40 hover:opacity-100 hover:text-destructive transition-opacity"
                    title="Remover termo"
                    aria-label="Remover termo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exibição dos Resultados Reais */}
        {searchTerm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {totalResults} {totalResults === 1 ? "resultado encontrado" : "resultados encontrados"}
              </span>
              <span className="font-mono text-[11px]">Firestore Live Index</span>
            </div>

            {totalResults === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm text-foreground">Nenhum dado encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nenhuma conversa ou arquivo gravado contém o termo &quot;{searchTerm}&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Conversas Encontradas */}
                {matchingConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      handleSaveSearchTerm(searchTerm)
                      onSelectConversation?.(conv.id)
                    }}
                    className="group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm text-foreground">
                          {conv.title}
                        </span>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Conversa
                        </span>
                      </div>
                      {conv.preview && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {conv.preview}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Abrir</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}

                {/* Arquivos Encontrados */}
                {matchingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm text-foreground">
                          {file.name}
                        </span>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Arquivo ({file.type.toUpperCase()})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {file.sizeFormatted}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guia Inicial quando a busca está vazia e sem termos */}
        {!searchTerm && recentSearches.length === 0 && (
          <div className="rounded-2xl border border-border/80 bg-card/40 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary/70 mb-3" />
            <h3 className="font-semibold text-sm text-foreground">Base de Dados Integrada</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Digite qualquer palavra para localizar trechos de código, respostas do AINEX ou arquivos armazenados no Firestore da sua conta.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
