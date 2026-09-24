"use client"

import { FormEvent, useState } from "react"
import { Plus, Paperclip, ArrowUp } from "lucide-react"
import { AinexOrb } from "@/components/ainex/ainex-orb"

export function ChatInput({ onSubmit, isLoading }: { onSubmit: (message: string) => void; isLoading: boolean }) {
  const [message, setMessage] = useState("")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (event.nativeEvent instanceof SubmitEvent && event.nativeEvent.isComposing) return
    const value = message.trim()
    if (!value || isLoading) return
    onSubmit(value)
    setMessage("")
  }

  return (
    <div className="border-t border-border bg-background p-4">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">JF</div>
        <button type="button" aria-label="Adicionar anexo" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-border">
          <Plus className="size-5 text-muted-foreground" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-input px-4 py-2">
          <input value={message} onChange={(event) => setMessage(event.target.value)} type="text" placeholder="Escreva uma mensagem..." aria-label="Mensagem" disabled={isLoading} className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none" />
          <button type="button" aria-label="Anexar arquivo" className="rounded p-1 transition-colors hover:bg-muted"><Paperclip className="size-5 text-muted-foreground" /></button>
          <button type="submit" aria-label="Enviar mensagem" disabled={isLoading || !message.trim()} className="rounded p-1 transition-colors hover:bg-muted disabled:opacity-50"><ArrowUp className="size-5 text-muted-foreground" /></button>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex"><AinexOrb size={24} state={isLoading ? "speaking" : "idle"} /><span className="text-sm text-foreground">AINEX</span></div>
      </form>
    </div>
  )
}
