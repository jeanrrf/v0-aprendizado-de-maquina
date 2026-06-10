"use client"

import { MessageSquare, Plus, MoreHorizontal, Star } from "lucide-react"

interface Conversation {
  id: string
  title: string
  preview: string
  time: string
  starred?: boolean
}

const conversations: Conversation[] = [
  {
    id: "1",
    title: "Chat com Claude",
    preview: "Pode me explicar o que é aprendizado de máquina?",
    time: "Agora",
    starred: true,
  },
  {
    id: "2",
    title: "Revisão de código React",
    preview: "Como otimizar o re-render de componentes?",
    time: "2h atrás",
  },
  {
    id: "3",
    title: "Plano de estudos",
    preview: "Monte um cronograma de 30 dias para TypeScript",
    time: "Ontem",
    starred: true,
  },
  {
    id: "4",
    title: "Ideias de marketing",
    preview: "Estratégias de lançamento para um SaaS",
    time: "2 dias atrás",
  },
  {
    id: "5",
    title: "Tradução de documento",
    preview: "Traduza este texto técnico para o inglês",
    time: "3 dias atrás",
  },
  {
    id: "6",
    title: "Resumo de artigo",
    preview: "Faça um resumo dos pontos principais",
    time: "5 dias atrás",
  },
]

export function MenuScreen() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Suas conversas</h1>
          <button className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>

        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{conv.title}</span>
                  {conv.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                </div>
                <p className="truncate text-sm text-muted-foreground">{conv.preview}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{conv.time}</span>
              <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
