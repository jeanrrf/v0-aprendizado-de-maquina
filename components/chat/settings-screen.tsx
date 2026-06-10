"use client"

import { User, Bell, Palette, Shield, Cpu, ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Section = "perfil" | "notificacoes" | "aparencia" | "privacidade" | "modelo"

const sections = [
  { id: "perfil" as const, icon: User, label: "Perfil" },
  { id: "modelo" as const, icon: Cpu, label: "Modelo" },
  { id: "notificacoes" as const, icon: Bell, label: "Notificações" },
  { id: "aparencia" as const, icon: Palette, label: "Aparência" },
  { id: "privacidade" as const, icon: Shield, label: "Privacidade" },
]

export function SettingsScreen() {
  const [active, setActive] = useState<Section>("perfil")

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-xl font-semibold text-foreground">Configurações</h1>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Submenu */}
          <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active === s.id
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="flex-1 rounded-xl border border-border bg-card p-6">
            {active === "perfil" && <ProfileSection />}
            {active === "modelo" && <ModelSection />}
            {active === "notificacoes" && <NotificationsSection />}
            {active === "aparencia" && <AppearanceSection />}
            {active === "privacidade" && <PrivacySection />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      <div className="rounded-lg border border-border bg-input px-3 py-2.5 text-foreground">{value}</div>
    </div>
  )
}

function Toggle({ label, description, on }: { label: string; description: string; on: boolean }) {
  const [enabled, setEnabled] = useState(on)
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  )
}

function ProfileSection() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
          JF
        </div>
        <div>
          <p className="font-medium text-foreground">João Ferreira</p>
          <p className="text-sm text-muted-foreground">Plano Pro</p>
        </div>
      </div>
      <Field label="Nome" value="João Ferreira" />
      <Field label="E-mail" value="joao.ferreira@email.com" />
      <Field label="Idioma" value="Português (Brasil)" />
    </div>
  )
}

function ModelSection() {
  const models = [
    { name: "Claude 3 Opus", desc: "Mais capaz para tarefas complexas", active: true },
    { name: "Claude 3 Sonnet", desc: "Equilíbrio entre desempenho e velocidade", active: false },
    { name: "Claude 3 Haiku", desc: "Mais rápido para respostas simples", active: false },
  ]
  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-muted-foreground">Selecione o modelo padrão</p>
      {models.map((m) => (
        <button
          key={m.name}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors",
            m.active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
          )}
        >
          <div>
            <p className="font-medium text-foreground">{m.name}</p>
            <p className="text-sm text-muted-foreground">{m.desc}</p>
          </div>
          {m.active && <ChevronRight className="h-4 w-4 text-primary" />}
        </button>
      ))}
    </div>
  )
}

function NotificationsSection() {
  return (
    <div className="divide-y divide-border">
      <Toggle label="Notificações por e-mail" description="Receba atualizações sobre suas conversas" on={true} />
      <Toggle label="Notificações push" description="Alertas no navegador" on={false} />
      <Toggle label="Resumo semanal" description="Resumo da sua atividade toda semana" on={true} />
      <Toggle label="Novidades do produto" description="Anúncios de novos recursos" on={false} />
    </div>
  )
}

function AppearanceSection() {
  const themes = ["Escuro", "Claro", "Sistema"]
  const [selected, setSelected] = useState("Escuro")
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-sm text-muted-foreground">Tema</p>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => setSelected(t)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm transition-colors",
                selected === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        <Toggle label="Reduzir animações" description="Minimiza efeitos de movimento" on={false} />
        <Toggle label="Modo compacto" description="Mais conteúdo na tela" on={false} />
      </div>
    </div>
  )
}

function PrivacySection() {
  return (
    <div className="divide-y divide-border">
      <Toggle label="Histórico de conversas" description="Salvar suas conversas" on={true} />
      <Toggle label="Melhorar o modelo" description="Permitir uso de dados para treinamento" on={false} />
      <Toggle label="Autenticação em duas etapas" description="Camada extra de segurança" on={true} />
      <div className="pt-4">
        <button className="rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
          Excluir todos os dados
        </button>
      </div>
    </div>
  )
}
