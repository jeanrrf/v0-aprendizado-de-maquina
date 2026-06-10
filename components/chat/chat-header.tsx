"use client"

import { ArrowLeft, MoreHorizontal } from "lucide-react"

interface ChatHeaderProps {
  title: string
  showModelInfo?: boolean
}

export function ChatHeader({ title, showModelInfo = false }: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 text-foreground transition-colors hover:text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">{title}</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {showModelInfo && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Modelo: <span className="text-foreground">Claude 3</span>
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">Responsivo</span>
          </>
        )}
        <button className="rounded p-1 transition-colors hover:bg-muted">
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
