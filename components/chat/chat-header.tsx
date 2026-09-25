"use client"

import { Cpu, Cloud, LogIn, ChevronDown } from "lucide-react"
import { User } from "firebase/auth"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ChatHeaderProps {
  title: string
  showModelInfo?: boolean
  modelName?: string
  onSelectModel?: (model: string) => void
  user?: User | null
  onSignIn?: () => void
}

const AVAILABLE_MODELS = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra 550B (Bicameral)", tag: "550B Raciocínio" },
  { id: "meta/llama-3.2-11b-vision-instruct", label: "Llama 3.2 11B Vision", tag: "Visão Rápida" },
  { id: "meta/llama-3.2-90b-vision-instruct", label: "Llama 3.2 90B Vision", tag: "Visão Pro" },
]

export function ChatHeader({
  title,
  showModelInfo = false,
  modelName = "nvidia/nemotron-3-ultra-550b-a55b",
  onSelectModel,
  user,
  onSignIn,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const currentLabel =
    AVAILABLE_MODELS.find((m) => m.id === modelName)?.label || modelName

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-foreground text-sm sm:text-base">{title}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Selector Dropdown */}
        {showModelInfo && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50"
              title="Clique para trocar de modelo NVIDIA"
            >
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline font-mono font-medium max-w-[200px] truncate">
                {currentLabel}
              </span>
              <span className="sm:hidden font-mono font-medium">NVIDIA</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Modelos NVIDIA Ativos
                </div>
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectModel?.(m.id)
                      setMenuOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                      modelName === m.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="truncate mr-2">
                      <div>{m.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</div>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {m.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User state / Google login */}
        {user ? (
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[120px] truncate text-foreground text-xs">
              {user.displayName || user.email || "Conectado"}
            </span>
          </div>
        ) : (
          onSignIn && (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Google</span>
            </button>
          )
        )}
      </div>
    </header>
  )
}
