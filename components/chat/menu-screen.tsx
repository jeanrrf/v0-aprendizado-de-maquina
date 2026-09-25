"use client"

import { MessageSquare, Plus, Trash2, Sparkles, LogIn } from "lucide-react"

export interface FirestoreConversation {
  id: string
  title: string
  preview?: string
  model?: string
  updatedAt?: any
}

interface MenuScreenProps {
  conversations: FirestoreConversation[]
  currentConversationId: string
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
  isAuthenticated: boolean
  onSignIn: () => void
}

export function MenuScreen({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isAuthenticated,
  onSignIn,
}: MenuScreenProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Sincronização em Nuvem AINEX</h2>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta Google para salvar suas conversas de forma persistente no Firestore e acessá-las de qualquer dispositivo.
          </p>
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:opacity-90"
          >
            <LogIn className="h-4 w-4" />
            Entrar com Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Suas conversas</h1>
            <p className="text-xs text-muted-foreground">Salvas em tempo real no Google Cloud Firestore</p>
          </div>
          <button
            onClick={onNewConversation}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-medium text-foreground">Nenhuma conversa encontrada</h3>
            <p className="mt-1 text-sm text-muted-foreground">Inicie uma nova conversa para persistir no banco de dados.</p>
            <button
              onClick={onNewConversation}
              className="mt-4 flex items-center gap-2 rounded-xl bg-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar primeira conversa
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const isSelected = conv.id === currentConversationId
              return (
                <div
                  key={conv.id}
                  className={`group relative flex w-full items-center gap-4 rounded-xl border p-3.5 text-left shadow-sm transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-card/90 shadow-md shadow-primary/10"
                      : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                  }`}
                >
                  <button
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex flex-1 items-center gap-4 text-left focus:outline-none"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/15">
                      <MessageSquare className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">{conv.title || "Conversa sem título"}</span>
                        {isSelected && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Ativa
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {conv.preview || "Conversa iniciada..."}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteConversation(conv.id)
                    }}
                    title="Excluir conversa"
                    className="rounded p-2 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                    aria-label="Excluir conversa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
