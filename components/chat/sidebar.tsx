"use client"

import { Menu, MessageCircle, Search, FileText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  activeItem: string
  onSelect: (id: string) => void
}

export function Sidebar({ activeItem, onSelect }: SidebarProps) {
  const items = [
    { id: "menu", icon: Menu, label: "Menu" },
    { id: "chat", icon: MessageCircle, label: "Chat" },
    { id: "search", icon: Search, label: "Pesquisar" },
    { id: "files", icon: FileText, label: "Arquivos" },
    { id: "settings", icon: Settings, label: "Configurações" },
  ]

  return (
    <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-sidebar py-4">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "mb-2 flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
            "hover:bg-sidebar-accent",
            activeItem === item.id ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground",
          )}
          aria-label={item.label}
          aria-current={activeItem === item.id ? "page" : undefined}
        >
          <item.icon className="h-5 w-5" />
        </button>
      ))}

      <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
        JF
      </div>
    </aside>
  )
}
