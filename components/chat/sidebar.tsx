"use client"

import { Menu, MessageCircle, Search, FileText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  activeItem?: string
}

export function Sidebar({ activeItem = "chat" }: SidebarProps) {
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
          className={cn(
            "mb-2 flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
            "hover:bg-sidebar-accent",
            activeItem === item.id && "text-sidebar-primary"
          )}
          aria-label={item.label}
        >
          <item.icon className="h-5 w-5" />
        </button>
      ))}
    </aside>
  )
}
