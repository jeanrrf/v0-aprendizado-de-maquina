"use client"

import { useEffect, useRef, useState } from "react"
import { AinexOrb, type AinexState } from "@/components/ainex/ainex-orb"
import { cn } from "@/lib/utils"
import { Activity, Cpu, Radio, Sparkles, Waves, Zap } from "lucide-react"

type LaunchPhase = "offline" | "booting" | "online"

const STATE_LABELS: Record<AinexState, string> = {
  idle: "Repouso",
  listening: "Ouvindo",
  thinking: "Processando",
  speaking: "Respondendo",
}

const STATE_CONTROLS: { id: AinexState; label: string; icon: typeof Waves }[] = [
  { id: "idle", label: "Repouso", icon: Radio },
  { id: "listening", label: "Ouvir", icon: Waves },
  { id: "thinking", label: "Processar", icon: Cpu },
  { id: "speaking", label: "Responder", icon: Activity },
]

// Target telemetry values per state (0..100)
const TELEMETRY: Record<AinexState, { sync: number; load: number; flow: number }> = {
  idle: { sync: 32, load: 12, flow: 24 },
  listening: { sync: 64, load: 38, flow: 55 },
  thinking: { sync: 88, load: 92, flow: 71 },
  speaking: { sync: 76, load: 58, flow: 96 },
}

const BOOT_LINES = [
  "Inicializando núcleo neural...",
  "Calibrando sinapses quânticas...",
  "Sincronizando malha de luz...",
  "AINEX online.",
]

export function NeuralConsole() {
  const [phase, setPhase] = useState<LaunchPhase>("offline")
  const [state, setState] = useState<AinexState>("idle")
  const [bootStep, setBootStep] = useState(0)

  // Boot sequence
  useEffect(() => {
    if (phase !== "booting") return
    setBootStep(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    BOOT_LINES.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => {
            setBootStep(i + 1)
            if (i === BOOT_LINES.length - 1) {
              setTimeout(() => {
                setPhase("online")
                setState("speaking")
                setTimeout(() => setState("idle"), 2600)
              }, 600)
            }
          },
          700 * (i + 1),
        ),
      )
    })
    return () => timers.forEach(clearTimeout)
  }, [phase])

  const orbState: AinexState = phase === "booting" ? "thinking" : phase === "offline" ? "idle" : state

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Hero */}
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Esfera de Luz Neural
          </span>

          <div className="relative flex items-center justify-center">
            {/* Decorative orbit rings */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 m-auto rounded-full border border-primary/20 transition-all duration-700",
                phase === "online" ? "h-64 w-64 opacity-100 sm:h-80 sm:w-80" : "h-56 w-56 opacity-0",
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-0 m-auto rounded-full border border-primary/10 transition-all duration-1000",
                phase === "online" ? "h-80 w-80 opacity-100 sm:h-96 sm:w-96" : "h-64 w-64 opacity-0",
              )}
            />
            <AinexOrb size={220} state={orbState} className="relative z-10" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-balance text-foreground sm:text-3xl">AINEX</h1>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full transition-colors",
                  phase === "online" ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
                )}
              />
              {phase === "offline" && "Inteligência em repouso"}
              {phase === "booting" && "Ativando núcleo neural..."}
              {phase === "online" && `Online · ${STATE_LABELS[state]}`}
            </p>
          </div>

          {/* Launch / boot area */}
          {phase !== "online" ? (
            <div className="flex min-h-24 flex-col items-center justify-center gap-3">
              {phase === "offline" && (
                <button
                  onClick={() => setPhase("booting")}
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
                  Ativar AINEX
                </button>
              )}
              {phase === "booting" && (
                <div className="w-full max-w-sm space-y-2 text-left font-mono text-xs">
                  {BOOT_LINES.slice(0, bootStep).map((line, i) => (
                    <div
                      key={line}
                      className={cn(
                        "flex items-center gap-2 duration-300 animate-in fade-in slide-in-from-left-2",
                        i === BOOT_LINES.length - 1 ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <span className="text-primary">{">"}</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <StateControls state={state} onChange={setState} />
          )}
        </div>

        {/* Telemetry grid (only once online) */}
        {phase === "online" && (
          <div className="mt-10 duration-500 animate-in fade-in-50 slide-in-from-bottom-3">
            <TelemetryPanel state={state} />
          </div>
        )}
      </div>
    </div>
  )
}

function StateControls({ state, onChange }: { state: AinexState; onChange: (s: AinexState) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {STATE_CONTROLS.map((ctrl) => {
        const active = state === ctrl.id
        return (
          <button
            key={ctrl.id}
            onClick={() => onChange(ctrl.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary/50 bg-primary/15 text-foreground shadow-sm shadow-primary/10"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <ctrl.icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
            {ctrl.label}
          </button>
        )
      })}
    </div>
  )
}

function TelemetryPanel({ state }: { state: AinexState }) {
  const target = TELEMETRY[state]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard label="Sincronia Neural" unit="%" target={target.sync} icon={Radio} />
      <MetricCard label="Carga de Processamento" unit="%" target={target.load} icon={Cpu} />
      <MetricCard label="Fluxo de Resposta" unit="%" target={target.flow} icon={Activity} />
    </div>
  )
}

function MetricCard({
  label,
  unit,
  target,
  icon: Icon,
}: {
  label: string
  unit: string
  target: number
  icon: typeof Activity
}) {
  const [value, setValue] = useState(target)
  const rafRef = useRef<number>(0)

  // Smoothly ease the displayed value toward the target, with a subtle live jitter.
  useEffect(() => {
    const tick = () => {
      setValue((prev) => {
        const jitter = (Math.random() - 0.5) * 2.5
        const goal = target + jitter
        return prev + (goal - prev) * 0.08
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  const display = Math.max(0, Math.min(100, value))

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </span>
        <span className="font-mono text-sm font-medium text-foreground tabular-nums">
          {Math.round(display)}
          {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${display}%` }}
        />
      </div>
    </div>
  )
}
