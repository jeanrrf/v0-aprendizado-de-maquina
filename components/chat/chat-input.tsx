"use client"

import { Plus, Paperclip, ArrowUp } from "lucide-react"
import { AinexOrb } from "@/components/ainex/ainex-orb"

export function ChatInput() {
  return (
    <div className="border-t border-border bg-background p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
          JF
        </div>
        
        {/* Add button */}
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-border transition-colors">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </button>
        
        {/* Input field */}
        <div className="flex flex-1 items-center gap-2 rounded-full bg-input border border-border px-4 py-2">
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <ArrowUp className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        
        {/* Send button */}
        <button className="flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 hover:bg-muted transition-colors">
          <AinexOrb size={24} state="idle" />
          <span className="text-sm text-foreground">AINEX</span>
        </button>
      </div>
    </div>
  )
}
