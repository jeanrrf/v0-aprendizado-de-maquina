"use client"

import { PenLine, GraduationCap, Code, MoreHorizontal } from "lucide-react"
import { AinexOrb } from "@/components/ainex/ainex-orb"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Pode me explicar o que é aprendizado de máquina?",
  },
  {
    id: "2",
    role: "assistant",
    content: `Claro! Aprendizado de máquina (ou machine learning) é uma área da inteligência artificial que se baseia em criar algoritmos que permitem aos computadores aprender a partir de dados. Em vez de serem programados explicitamente para realizar uma tarefa, esses sistemas treinam com base em padrões e fazer previsões ou decisões com base nos dados fornecidos. É como ensinar ao computador a "aprender" com exemplos, de modo que ele possa melhorar automaticamente suas respostas ao longo do tempo.`,
  },
]

export function ChatMessages() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <AinexHero />
        {mockMessages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <UserMessage content={message.content} />
            ) : (
              <AssistantMessage content={message.content} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AinexHero() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <AinexOrb size={120} state="idle" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">AINEX</h2>
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Esfera de luz neural · online
        </p>
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-md rounded-2xl bg-card border border-border px-4 py-3">
        <p className="text-foreground">{content}</p>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">Você</span>
    </div>
  )
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <AinexOrb size={32} state="speaking" />
          <span className="font-semibold text-foreground">AINEX</span>
        </div>
        <p className="leading-relaxed text-foreground">{content}</p>
      </div>
      
      <div className="flex items-center justify-center gap-2">
        <ActionButton icon={PenLine} label="Escrever" />
        <ActionButton icon={GraduationCap} label="Aprender" />
        <ActionButton icon={Code} label="Código" />
        <div className="flex items-center gap-1 rounded-full border border-border px-3 py-2">
          <span className="text-sm text-muted-foreground">59</span>
        </div>
        <button className="flex items-center justify-center rounded-full border border-border p-2 hover:bg-muted transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}
