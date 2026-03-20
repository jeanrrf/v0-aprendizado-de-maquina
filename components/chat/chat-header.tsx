"use client"

import { ArrowLeft, MoreHorizontal } from "lucide-react"

export function ChatHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 text-foreground hover:text-muted-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">Chat com Claude</span>
        </button>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Modelo: <span className="text-foreground">Claude 3</span>
        </span>
        <span className="text-sm text-muted-foreground">Responsivo</span>
        <button className="p-1 hover:bg-muted rounded transition-colors">
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
