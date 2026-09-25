"use client"

import { User, Bell, Palette, Shield, Cpu, Check, Key, Sliders, Zap } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { NimParameters, DEFAULT_NIM_PARAMS } from "@/lib/nim-config"

type Section = "modelo" | "perfil" | "notificacoes" | "aparencia" | "privacidade"

const sections = [
  { id: "modelo" as const, icon: Cpu, label: "Modelo & NIM" },
  { id: "perfil" as const, icon: User, label: "Perfil" },
  { id: "notificacoes" as const, icon: Bell, label: "Notificações" },
  { id: "aparencia" as const, icon: Palette, label: "Aparência" },
  { id: "privacidade" as const, icon: Shield, label: "Privacidade" },
]

interface SettingsScreenProps {
  currentModel?: string
  onSelectModel?: (model: string) => void
  nimParams?: NimParameters
  onChangeNimParams?: (params: NimParameters) => void
}

export function SettingsScreen({
  currentModel = "meta/llama-3.2-11b-vision-instruct",
  onSelectModel,
  nimParams = DEFAULT_NIM_PARAMS,
  onChangeNimParams,
}: SettingsScreenProps) {
  const [active, setActive] = useState<Section>("modelo")

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-xl font-semibold text-foreground">Configurações do Sistema</h1>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Submenu */}
          <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === s.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active === s.id && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary md:block" />
                )}
                <s.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active === s.id ? "text-primary" : "group-hover:text-foreground",
                  )}
                />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="flex-1 rounded-xl border border-border bg-card p-6">
            {active === "modelo" && (
              <ModelSection
                currentModel={currentModel}
                onSelectModel={onSelectModel}
                nimParams={nimParams}
                onChangeNimParams={onChangeNimParams}
              />
            )}
            {active === "perfil" && <ProfileSection />}
            {active === "notificacoes" && <NotificationsSection />}
            {active === "aparencia" && <AppearanceSection />}
            {active === "privacidade" && <PrivacySection />}
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
      id: "meta/llama-3.2-11b-vision-instruct",
      name: "Meta LLaMA 3.2 11B (NVIDIA NIM)",
      badge: "Recomendado · Streaming Ultra-rápido",
      desc: "Novo modelo ultra-rápido, responsivo e excelente em raciocínio, lógica e português.",
    },
    {
      id: "nvidia/nemotron-3-ultra-550b-a55b",
      name: "NVIDIA Nemotron 3 Ultra 550B",
      badge: "Arquitetura AINEX",
      desc: "Modelo fundacional da NVIDIA com raciocínio analítico profundo.",
    },
    {
      id: "nvidia/nemotron-3-super-120b-a12b",
      name: "NVIDIA Nemotron 3 Super 120B",
      badge: "Equilibrado",
      desc: "Modelo intermediário da família Nemotron para processamento de linguagem natural.",
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
                  : "border-border hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{m.name}</span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                    {m.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
                <code className="mt-2 block text-[11px] text-primary/80 font-mono">
                  {m.id}
                </code>
              </div>
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border group-hover:border-primary/40",
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
              Transmissão token a token em tempo real diretamente do microserviço NVIDIA.
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
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0.0 (Factual / Determinístico)</span>
            <span>1.0 (Criativo / Aberto)</span>
          </div>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground/80">{label}</label>
      <input
        defaultValue={value}
        className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-foreground transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  )
}

function ProfileSection() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
          AI
        </div>
        <div>
          <p className="font-medium text-foreground">Usuário AINEX</p>
          <p className="text-sm text-muted-foreground">Plano Neural NVIDIA NIM</p>
        </div>
      </div>
      <Field label="Nome" value="Operador AINEX" />
      <Field label="Status" value="Ativo e Sincronizado" />
    </div>
  )
}

function NotificationsSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Alertas de telemetria e sincronização neural ativos.
      </p>
    </div>
  )
}

function AppearanceSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tema futurista escuro otimizado para a esfera neural AINEX.
      </p>
    </div>
  )
}

function PrivacySection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        As conversas são criptografadas e mantidas no seu Firestore privado.
      </p>
    </div>
  )
}
