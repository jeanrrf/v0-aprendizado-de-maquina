"use client"

import { useEffect, useRef, useState } from "react"
import { Zap, Activity, Waves, Database } from "lucide-react"
import { User } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { cn } from "@/lib/utils"

type FieldStatus = "idle" | "tuning" | "resonance"

interface Node {
  angle: number
  radius: number
  speed: number
  phase: number
}

interface Flow {
  t: number
  speed: number
  lateral: number
  surface: number
}

interface Burst {
  t: number
}

interface ResonanceFieldProps {
  user?: User | null
}

export function ResonanceField({ user }: ResonanceFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<FieldStatus>("idle")
  const [charge, setCharge] = useState(0)
  const [sync, setSync] = useState(0)
  const [pulses, setPulses] = useState(0)
  const [persistedInCloud, setPersistedInCloud] = useState(false)

  const readout = useRef({ status: "idle" as FieldStatus, charge: 0, sync: 0, pulses: 0 })
  const lastSavedPulses = useRef(0)

  // Carrega telemetria persistida no Firestore
  useEffect(() => {
    if (!user) return
    let active = true

    async function loadTelemetry() {
      try {
        const snap = await getDoc(doc(db, "users", user!.uid, "resonance", "telemetry"))
        if (snap.exists() && active) {
          const data = snap.data()
          if (typeof data.pulses === "number") {
            readout.current.pulses = data.pulses
            lastSavedPulses.current = data.pulses
            setPulses(data.pulses)
          }
          setPersistedInCloud(true)
        }
      } catch (err) {
        console.warn("Could not load resonance telemetry:", err)
      }
    }

    loadTelemetry()
    return () => {
      active = false
    }
  }, [user])

  // Salva periodicamente a telemetria no Firestore quando há pulsos ou atividade
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      if (readout.current.pulses !== lastSavedPulses.current) {
        lastSavedPulses.current = readout.current.pulses
        try {
          await setDoc(
            doc(db, "users", user.uid, "resonance", "telemetry"),
            {
              pulses: readout.current.pulses,
              charge: readout.current.charge,
              sync: readout.current.sync,
              status: readout.current.status,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
          setPersistedInCloud(true)
        } catch (err) {
          console.warn("Could not sync resonance telemetry to Firestore:", err)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1
    let w = wrap.clientWidth || 300
    let h = wrap.clientHeight || 300

    const resize = () => {
      if (!wrap || !canvas) return
      w = wrap.clientWidth
      h = wrap.clientHeight
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    let energy = 0.22
    let chargeVal = 0
    let resonanceTimer = 0
    let pulseCount = readout.current.pulses

    const pointer = {
      x: w / 2,
      y: h / 2,
      targetX: w / 2,
      targetY: h / 2,
      vx: 0,
      vy: 0,
      speed: 0,
      engaged: false,
      down: false,
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.targetX = e.clientX - rect.left
      pointer.targetY = e.clientY - rect.top
      pointer.engaged = true
    }
    const onDown = (e: PointerEvent) => {
      pointer.down = true
      pointer.engaged = true
      onMove(e)
    }
    const onUp = () => {
      pointer.down = false
    }
    const onLeave = () => {
      pointer.engaged = false
      pointer.down = false
    }

    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerdown", onDown)
    window.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointerleave", onLeave)

    const nodes: Node[] = Array.from({ length: 9 }, (_, i) => ({
      angle: (i / 9) * Math.PI * 2,
      radius: 0.82 + Math.sin(i * 1.3) * 0.18,
      speed: 0.008 + (i % 3) * 0.003,
      phase: i * 0.7,
    }))

    const flows: Flow[] = Array.from({ length: 18 }, (_, i) => ({
      t: Math.random(),
      speed: 0.012 + Math.random() * 0.018,
      lateral: (Math.random() - 0.5) * 1.2,
      surface: (i / 18) * Math.PI * 2,
    }))

    const bursts: Burst[] = []

    let raf = 0
    let lastT = performance.now()
    let frame = 0

    const rgba = (a: number) => `rgba(235, 30, 45, ${Math.max(0, Math.min(1, a))})`

    let isVisible = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
      },
      { threshold: 0 }
    )
    if (canvas) observer.observe(canvas)

    const draw = (now: number) => {
      if (!isVisible) {
        raf = requestAnimationFrame(draw)
        return
      }
      frame++
      lastT = now
      const t = now * 0.001

      const pSmooth = 0.18
      const dx = pointer.targetX - pointer.x
      const dy = pointer.targetY - pointer.y
      pointer.x += dx * pSmooth
      pointer.y += dy * pSmooth
      pointer.speed = Math.hypot(dx, dy)

      const cxBase = w / 2
      const cyBase = h / 2
      const R = Math.min(w, h) * 0.42
      const coreBase = R * 0.19

      const leanX = pointer.engaged ? (pointer.x - cxBase) * 0.06 : 0
      const leanY = pointer.engaged ? (pointer.y - cyBase) * 0.06 : 0
      const cx = cxBase + leanX
      const cy = cyBase + leanY

      const pdx = pointer.x - cx
      const pdy = pointer.y - cy
      const pdist = Math.hypot(pdx, pdy)
      const proximity = pointer.engaged ? Math.max(0, 1 - pdist / (R * 0.6)) : 0

      const tuning = pointer.engaged && proximity > 0.05
      if (resonanceTimer > 0) {
        resonanceTimer -= 0.016
      } else if (tuning) {
        const gain = (0.004 + Math.min(pointer.speed, 14) * 0.0016) * (0.4 + proximity)
        chargeVal = Math.min(1, chargeVal + gain)
        if (chargeVal >= 1) {
          bursts.push({ t: 0 })
          pulseCount++
          resonanceTimer = 1.3
          chargeVal = 0
        }
      } else {
        chargeVal = Math.max(0, chargeVal - 0.006)
      }

      const resonant = resonanceTimer > 0
      const currentStatus: FieldStatus = resonant ? "resonance" : tuning ? "tuning" : "idle"

      const targetEnergy = resonant ? 1 : tuning ? 0.55 + proximity * 0.35 : 0.22
      energy += (targetEnergy - energy) * 0.06

      ctx.clearRect(0, 0, w, h)

      const breath = Math.sin(t * 1.4) * 0.5 + 0.5
      const flash = resonant ? Math.max(0, resonanceTimer / 1.3) : 0
      const coreR = coreBase * (1 + breath * 0.06 + energy * 0.14 + flash * 0.4)

      // Aura
      const auraR = R * (0.34 + breath * 0.02 + energy * 0.06 + flash * 0.12)
      const aura = ctx.createRadialGradient(cx, cy, Math.max(1, coreR * 0.4), cx, cy, Math.max(2, auraR))
      aura.addColorStop(0, rgba(0.28 + energy * 0.25 + flash * 0.2))
      aura.addColorStop(0.5, rgba(0.1 + energy * 0.08))
      aura.addColorStop(1, "rgba(235, 30, 45, 0)")
      ctx.fillStyle = aura
      ctx.beginPath()
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2)
      ctx.fill()

      // Bursts
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]
        b.t += 0.02
        if (b.t >= 1) {
          bursts.splice(i, 1)
          continue
        }
        const rr = coreR + b.t * R * 0.55
        ctx.strokeStyle = rgba((1 - b.t) * 0.5)
        ctx.lineWidth = 2 * (1 - b.t)
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Energy particles
      if (tuning) {
        for (const f of flows) {
          f.t += f.speed * (0.6 + proximity)
          if (f.t > 1) f.t -= 1
          const sx = cx + Math.cos(f.surface) * coreR
          const sy = cy + Math.sin(f.surface) * coreR
          const mx = (sx + pointer.x) / 2 + pdy * 0.12 * f.lateral
          const my = (sy + pointer.y) / 2 - pdx * 0.12 * f.lateral
          const u = f.t
          const iu = 1 - u
          const x = iu * iu * sx + 2 * iu * u * mx + u * u * pointer.x
          const y = iu * iu * sy + 2 * iu * u * my + u * u * pointer.y
          const fade = Math.sin(u * Math.PI)
          ctx.fillStyle = rgba(fade * (0.4 + proximity * 0.5))
          ctx.beginPath()
          ctx.arc(x, y, 1.5 * fade + 0.5, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.strokeStyle = rgba(0.5 + proximity * 0.4)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Orbiting nodes
      const spd = resonant ? 2.5 : tuning ? 1.5 : 1
      const pos: { x: number; y: number; depth: number }[] = []
      for (const n of nodes) {
        n.angle += n.speed * spd
        const orbit = coreBase + n.radius * R * 0.12
        const x = cx + Math.cos(n.angle) * orbit
        const y = cy + Math.sin(n.angle) * orbit * 0.82
        const depth = (Math.sin(n.angle + n.phase) + 1) / 2
        pos.push({ x, y, depth })
      }

      for (const p of pos) {
        ctx.fillStyle = rgba((0.3 + p.depth * 0.7) * (0.5 + energy * 0.5))
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1 + p.depth * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Core glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreR))
      core.addColorStop(0, "rgba(255,255,255,0.95)")
      core.addColorStop(0.35, rgba(0.95))
      core.addColorStop(0.7, rgba(0.5))
      core.addColorStop(1, rgba(0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()

      if (frame % 15 === 0) {
        readout.current = {
          status: currentStatus,
          charge: Math.round(chargeVal * 100),
          sync: Math.round((0.4 + energy * 0.6) * 100),
          pulses: pulseCount,
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    const interval = window.setInterval(() => {
      setStatus((prev) => (prev !== readout.current.status ? readout.current.status : prev))
      setCharge((prev) => (prev !== readout.current.charge ? readout.current.charge : prev))
      setSync((prev) => (prev !== readout.current.sync ? readout.current.sync : prev))
      setPulses((prev) => (prev !== readout.current.pulses ? readout.current.pulses : prev))
    }, 250)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.clearInterval(interval)
      ro.disconnect()
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  const statusLabel =
    status === "resonance"
      ? "Ressonância Neural Ativa"
      : status === "tuning"
      ? "Sintonizando Campo"
      : "Aguardando Interação"

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Campo de Ressonância AINEX</h1>
            <p className="text-xs text-muted-foreground">
              Simulação neural interativa com persistência de telemetria no Firestore
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                status === "resonance"
                  ? "border-primary bg-primary/20 text-primary animate-pulse"
                  : status === "tuning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
            {user && persistedInCloud && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <Database className="h-3 w-3" />
                <span>Sincronizado</span>
              </span>
            )}
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black/40 shadow-inner">
          <div ref={wrapRef} className="absolute inset-0">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Campo de ressonância interativo"
              className="block h-full w-full cursor-crosshair touch-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric icon={Zap} label="Carga de ressonância" value={`${charge}%`} progress={charge} />
          <Metric icon={Activity} label="Sincronia neural" value={`${sync}%`} progress={sync} />
          <Metric icon={Waves} label="Pulsos emitidos (Firestore)" value={String(pulses)} />
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  progress,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  progress?: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
