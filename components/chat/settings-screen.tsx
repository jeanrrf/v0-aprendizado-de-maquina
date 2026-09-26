"use client"

import { useState, useEffect } from "react"
import {
  User as UserIcon,
  Bell,
  Palette,
  Shield,
  Cpu,
  Check,
  Key,
  Sliders,
  Zap,
  Save,
  Database,
  Loader2,
  HardDrive,
  RotateCcw,
} from "lucide-react"
import { User } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { NimParameters, DEFAULT_NIM_PARAMS } from "@/lib/nim-config"
import { conversationCache } from "@/lib/cache/lru-conversation-cache"

type Section = "modelo" | "perfil" | "notificacoes" | "aparencia" | "privacidade"

const sections = [
  { id: "modelo" as const, icon: Cpu, label: "Modelo & NIM" },
  { id: "perfil" as const, icon: UserIcon, label: "Perfil" },
  { id: "notificacoes" as const, icon: Bell, label: "Notificações" },
  { id: "aparencia" as const, icon: Palette, label: "Aparência" },
  { id: "privacidade" as const, icon: Shield, label: "Privacidade" },
]

interface SettingsScreenProps {
  currentModel?: string
  onSelectModel?: (model: string) => void
  nimParams?: NimParameters
  onChangeNimParams?: (params: NimParameters) => void
  user: User | null
  onSignIn: () => void
}

export function SettingsScreen({
  currentModel = "z-ai/glm-5.3-flash",
  onSelectModel,
  nimParams = DEFAULT_NIM_PARAMS,
  onChangeNimParams,
  user,
  onSignIn,
}: SettingsScreenProps) {
  const [active, setActive] = useState<Section>("modelo")
  const [displayName, setDisplayName] = useState(user?.displayName || "")
  const [statusTitle, setStatusTitle] = useState("Operador Neural AINEX")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Carrega preferências reais do Firestore
  useEffect(() => {
    if (!user) return
    let mounted = true

    async function loadUserProfile() {
      try {
        const userSnap = await getDoc(doc(db, "users", user!.uid))
        if (userSnap.exists() && mounted) {
          const data = userSnap.data()
          if (data.displayName) setDisplayName(data.displayName)
          if (data.statusTitle) setStatusTitle(data.statusTitle)
          if (data.preferredModel && onSelectModel) {
            onSelectModel(data.preferredModel)
          }
          if (data.nimParams && onChangeNimParams) {
            onChangeNimParams(data.nimParams)
          }
        }
      } catch (err) {
        console.warn("Could not load user profile from Firestore:", err)
      }
    }

    loadUserProfile()
    return () => {
      mounted = false
    }
  }, [user, onSelectModel, onChangeNimParams])

  // Salva no Firestore
  const handleSaveProfile = async () => {
    if (!user) {
      onSignIn()
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const userRef = doc(db, "users", user.uid)
      await setDoc(
        userRef,
        {
          displayName,
          statusTitle,
          preferredModel: currentModel,
          nimParams,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Erro ao salvar no Firestore:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Configurações do Sistema</h1>
          {user && (
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95",
                isSaving && "opacity-70 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Gravando no Firestore...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Salvo na nuvem!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Salvar Preferências</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Submenu de navegação */}
          <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === s.id
                    ? "bg-card text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {active === s.id && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary md:block" />
                )}
                <s.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active === s.id ? "text-primary" : "group-hover:text-foreground"
                  )}
                />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Conteúdo dinâmico da aba */}
          <div className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-sm">
            {active === "modelo" && (
              <ModelSection
                currentModel={currentModel}
                onSelectModel={onSelectModel}
                nimParams={nimParams}
                onChangeNimParams={onChangeNimParams}
              />
            )}
            {active === "perfil" && (
              <ProfileSection
                user={user}
                displayName={displayName}
                setDisplayName={setDisplayName}
                statusTitle={statusTitle}
                setStatusTitle={setStatusTitle}
                onSignIn={onSignIn}
              />
            )}
            {active === "notificacoes" && <NotificationsSection />}
            {active === "aparencia" && <AppearanceSection />}
            {active === "privacidade" && <PrivacySection user={user} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelSection({
  currentModel,
  onSelectModel,
  nimParams = DEFAULT_NIM_PARAMS,
  onChangeNimParams,
}: {
  currentModel: string
  onSelectModel?: (model: string) => void
  nimParams?: NimParameters
  onChangeNimParams?: (params: NimParameters) => void
}) {
  const models = [
    {
      id: "z-ai/glm-5.3-flash",
      name: "Z-AI GLM-5.3-Flash",
      badge: "Nativo Multimodal · Prioridade NIM",
      desc: "Modelo de elite da Z-AI com 320B total / 18B ativos. MoE com KDA híbrido e atenção MLA esparsa.",
    },
    {
      id: "deepseek-ai/deepseek-v4.1-flash",
      name: "DeepSeek v4.1 Flash",
      badge: "Multimodal MoE · Eficiente",
      desc: "552B MoE com 8B ativos. Suporte multimodal nativo e baixo custo de API.",
    },
    {
      id: "moonshotai/kimi-k3",
      name: "Moonshot AI Kimi-k3",
      badge: "Contexto Longo · 2.8T Params",
      desc: "Modelo massivo para coding de longo horizonte, uso de agentes e compreensão de imagem.",
    },
    {
      id: "meta/muse-glimmer-30b",
      name: "Meta Muse Glimmer 30B",
      badge: "Raciocínio Multimodal",
      desc: "Modelo de raciocínio multimodal aceitando texto e imagens com tool-calling nativo.",
    },
    {
      id: "meta/llama-3.2-11b-vision-instruct",
      name: "Meta LLaMA 3.2 11B (Vision)",
      badge: "Recomendado · Responsivo",
      desc: "Modelo ultra-rápido da Meta para tarefas de visão e chat geral.",
    },
    {
      id: "nvidia/nemotron-3-ultra-550b-a55b",
      name: "NVIDIA Nemotron 3 Ultra 550B",
      badge: "Arquitetura AINEX",
      desc: "Modelo fundacional da NVIDIA com raciocínio analítico profundo.",
    },
    {
      id: "meta/llama-guard-4-12b",
      name: "Llama Guard 4 12B (Safety)",
      badge: "Classificador de Segurança",
      desc: "Modelo multimodal especializado em classificar a segurança de prompts e respostas.",
    },
  ]

  const updateParam = <K extends keyof NimParameters>(key: K, val: NimParameters[K]) => {
    if (onChangeNimParams) {
      onChangeNimParams({ ...nimParams, [key]: val })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com status da API */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Conexão NVIDIA NIM</h2>
          <p className="text-xs text-muted-foreground">
            Inference Microservice com streaming SSE nativo
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <Key className="h-3 w-3" />
          <span>NVIDIA API Key Ativa</span>
        </div>
      </div>

      {/* Seletor de Modelos */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Modelo NIM Selecionado:</p>
        {models.map((m) => {
          const isSelected = currentModel === m.id
          return (
            <button
              key={m.id}
              onClick={() => onSelectModel?.(m.id)}
              className={cn(
                "group flex w-full items-start justify-between rounded-xl border p-4 text-left transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">{m.name}</span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                    {m.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
                <code className="mt-2 block text-[11px] text-primary/80 font-mono">{m.id}</code>
              </div>
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border group-hover:border-primary/40"
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Parâmetros Nativos da NIM */}
      <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Parâmetros Nativos da NIM</h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">OpenAI / NIM v1 Spec</span>
        </div>

        {/* Streaming SSE Toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Stream (Server-Sent Events)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Transmissão token a token em tempo real diretamente da GPU NVIDIA.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={nimParams.stream}
              onChange={(e) => updateParam("stream", e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-muted peer-checked:bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
          </label>
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Temperature (Criatividade / Precisão)</span>
            <span className="font-mono text-primary">{nimParams.temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={nimParams.temperature}
            onChange={(e) => updateParam("temperature", parseFloat(e.target.value))}
            className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Top P */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Top P (Nucleus Sampling)</span>
            <span className="font-mono text-primary">{nimParams.top_p.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={nimParams.top_p}
            onChange={(e) => updateParam("top_p", parseFloat(e.target.value))}
            className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Max Tokens (Limite de Resposta)</span>
            <span className="font-mono text-primary">{nimParams.max_tokens} tokens</span>
          </div>
          <input
            type="range"
            min="256"
            max="4096"
            step="128"
            value={nimParams.max_tokens}
            onChange={(e) => updateParam("max_tokens", parseInt(e.target.value, 10))}
            className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}

function ProfileSection({
  user,
  displayName,
  setDisplayName,
  statusTitle,
  setStatusTitle,
  onSignIn,
}: {
  user: User | null
  displayName: string
  setDisplayName: (val: string) => void
  statusTitle: string
  setStatusTitle: (val: string) => void
  onSignIn: () => void
}) {
  if (!user) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Conecte sua conta para personalizar seu perfil e sincronizar com o banco de dados.
        </p>
        <button
          onClick={onSignIn}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Entrar com Google
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={displayName}
            className="h-16 w-16 rounded-full border border-border object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground border border-border">
            {displayName.slice(0, 2).toUpperCase() || "OP"}
          </div>
        )}
        <div>
          <p className="font-semibold text-foreground">{displayName || "Operador AINEX"}</p>
          <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
            <Database className="h-3 w-3" />
            <span>Perfil persistido no Firestore</span>
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-foreground">Nome de Exibição</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Seu nome"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-foreground">Título / Função</label>
        <input
          value={statusTitle}
          onChange={(e) => setStatusTitle(e.target.value)}
          placeholder="Ex: Engenheiro de IA, Pesquisador..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Identificador de Usuário (UID):</p>
        <code className="block font-mono text-[11px] text-primary">{user.uid}</code>
      </div>
    </div>
  )
}

function NotificationsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Alertas e Telemetria</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Todas as notificações de resposta e status de streaming são enviadas via canais nativos do navegador e gravadas no log de eventos do Firestore.
      </p>
    </div>
  )
}

function AppearanceSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Tema e Estética Visual</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Tema neural escuro com contraste otimizado para longas sessões de desenvolvimento e visualização da esfera quântica.
      </p>
    </div>
  )
}

function PrivacySection({ user }: { user: User | null }) {
  const [stats, setStats] = useState(() => conversationCache.getStats())
  const [cacheCleared, setCacheCleared] = useState(false)

  const handleClearCache = () => {
    conversationCache.clear(user?.uid)
    setStats(conversationCache.getStats())
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2500)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Políticas e Armazenamento Seguro</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Suas conversas e arquivos são salvos exclusivamente no Firestore isolado do projeto Google Cloud sob regras estritas de segurança (`isOwner`). Nenhum dado pessoal é exposto a terceiros.
      </p>

      {user && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Autenticado como: <span className="font-mono text-foreground">{user.email}</span>
        </div>
      )}

      {/* Camada de Cache Local LRU */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold text-foreground">Cache Local LRU (Least Recently Used)</h4>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
            Ativo (0ms Navigation)
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Mantém em memória e armazenamento seguro as últimas 25 conversas acessadas. Reduz consultas redundantes de leitura ao Firestore e garante troca instantânea de chats.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
          <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase font-sans">Em Cache</p>
            <p className="text-base font-bold text-foreground mt-0.5">{stats.size} / {stats.capacity}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase font-sans">Hits Salvos</p>
            <p className="text-base font-bold text-emerald-400 mt-0.5">{stats.hits}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase font-sans">Hit Rate</p>
            <p className="text-base font-bold text-primary mt-0.5">{stats.hitRate}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleClearCache}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpar Cache LRU</span>
          </button>
          {cacheCleared && (
            <span className="text-[11px] text-emerald-400 font-medium animate-fade-in">
              Cache limpo com sucesso!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

