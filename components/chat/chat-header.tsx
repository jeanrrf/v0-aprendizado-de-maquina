"use client"

import { Cpu, Cloud, LogIn, ChevronDown, Check, Plus, Radio } from "lucide-react"
import { User } from "firebase/auth"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"

interface ChatHeaderProps {
  title: string
  showModelInfo?: boolean
  modelName?: string
  onSelectModel?: (model: string) => void
  onNewChat?: () => void
  onStartLive?: () => void
  user?: User | null
  onSignIn?: () => void
}

const AVAILABLE_MODELS = [
  { id: "z-ai/glm-5.3-flash", label: "GLM-5.3-Flash", tag: "Elite NIM", desc: "Prioridade Multimodal" },
  { id: "deepseek-ai/deepseek-v4.1-flash", label: "DeepSeek v4.1 Flash", tag: "MoE", desc: "Eficiência Extrema" },
  { id: "moonshotai/kimi-k3", label: "Kimi-k3", tag: "2.8T", desc: "Contexto Massivo" },
  { id: "meta/muse-glimmer-30b", label: "Muse Glimmer 30B", tag: "Raciocínio", desc: "Visão & Lógica" },
  { id: "meta/llama-3.2-11b-vision-instruct", label: "Llama 3.2 11B Vision", tag: "Fast", desc: "Visão Responsiva" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra 550B", tag: "Dual", desc: "Raciocínio Profundo" },
  { id: "meta/llama-guard-4-12b", label: "Llama Guard 4 12B", tag: "Safety", desc: "Filtro de Segurança" },
]

export function ChatHeader({
  title,
  showModelInfo = false,
  modelName = "z-ai/glm-5.3-flash",
  onSelectModel,
  onNewChat,
  onStartLive,
  user,
  onSignIn,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentLabel =
    AVAILABLE_MODELS.find((m) => m.id === modelName)?.label || modelName

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuOpen])

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 bg-background/60 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-foreground text-sm sm:text-base tracking-tight">{title}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* New Chat Button */}
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary/50 active:scale-95"
            title="Nova Conversa"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Nova Chat</span>
          </button>
        )}

        {/* Live API Button */}
        {onStartLive && (
          <button
            onClick={onStartLive}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10 active:scale-95"
            title="Iniciar Conversa por Voz (Live API)"
          >
            <Radio className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voz Live</span>
          </button>
        )}

        {/* Model Selector Dropdown */}
        {showModelInfo && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all duration-200",
                menuOpen 
                  ? "border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/10" 
                  : "border-border bg-secondary/30 text-foreground hover:border-primary/30 hover:bg-secondary/50"
              )}
            >
              <Cpu className={cn("h-3.5 w-3.5 transition-colors", menuOpen ? "text-primary" : "text-primary/70")} />
              <span className="hidden sm:inline font-mono font-bold uppercase tracking-widest text-[10px]">
                {currentLabel}
              </span>
              <span className="sm:hidden font-mono font-bold uppercase tracking-widest text-[10px]">NVIDIA</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", menuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 z-[100] w-80 overflow-hidden rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/10"
                >
                  <div className="bg-muted/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50">
                    Motores de Inferência NVIDIA
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto py-1 scrollbar-none">
                    {AVAILABLE_MODELS.map((m) => {
                      const isSelected = modelName === m.id
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectModel?.(m.id)
                            setMenuOpen(false)
                          }}
                          className={cn(
                            "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-accent",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            isSelected ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground group-hover:border-primary/30"
                          )}>
                            {isSelected ? <Check className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>
                                {m.label}
                              </span>
                              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                                {m.tag}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate font-medium">
                              {m.desc}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* User state / Google login */}
        {user ? (
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground">
            <Cloud className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[100px] truncate text-foreground font-medium">
              {user.displayName || user.email?.split('@')[0] || "Operador"}
            </span>
          </div>
        ) : (
          onSignIn && (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Acessar Sistema</span>
              <span className="sm:hidden">Login</span>
            </button>
          )
        )}
      </div>
    </header>
  )
}
