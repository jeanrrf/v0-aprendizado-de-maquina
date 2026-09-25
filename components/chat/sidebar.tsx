"use client"

import { Menu, MessageCircle, Search, FileText, Settings, Sparkles, LogIn, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { User } from "firebase/auth"

interface SidebarProps {
  activeItem: string
  onSelect: (id: string) => void
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
}

export function Sidebar({ activeItem, onSelect, user, onSignIn, onSignOut }: SidebarProps) {
  const items = [
    { id: "ainex", icon: Sparkles, label: "AINEX" },
    { id: "menu", icon: Menu, label: "Menu" },
    { id: "chat", icon: MessageCircle, label: "Chat" },
    { id: "search", icon: Search, label: "Pesquisar" },
    { id: "files", icon: FileText, label: "Arquivos" },
    { id: "settings", icon: Settings, label: "Configurações" },
  ]

  const userInitials = user?.displayName
    ? user.displayName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "G"

  return (
    <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-sidebar py-4">
      <div className="flex flex-col items-center space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "group relative flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              activeItem === item.id
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
            aria-label={item.label}
            aria-current={activeItem === item.id ? "page" : undefined}
          >
            {activeItem === item.id && (
              <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <item.icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        {user ? (
          <div className="group relative flex flex-col items-center">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName || "Usuário"}
                className="h-10 w-10 rounded-full border border-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                {userInitials}
              </div>
            )}
            <button
              onClick={onSignOut}
              title="Sair da conta"
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            title="Entrar com Google"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary transition-all hover:bg-primary hover:text-primary-foreground"
            aria-label="Entrar com Google"
          >
            <LogIn className="h-5 w-5" />
          </button>
        )}
      </div>
    </aside>
  )
}
