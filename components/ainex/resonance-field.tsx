"use client"

import { useEffect, useRef, useState } from "react"
import { Zap, Hand, Activity, Waves } from "lucide-react"
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

export function ResonanceField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<FieldStatus>("idle")
  const [charge, setCharge] = useState(0)
  const [sync, setSync] = useState(0)
  const [pulses, setPulses] = useState(0)

  const readout = useRef({ status: "idle" as FieldStatus, charge: 0, sync: 0, pulses: 0 })

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

    const rgba = (a: number) => `rgba(225, 29, 72, ${a})`

    // Pointer state
    const pointer = { x: w / 2, y: h / 2, tx: w / 2, ty: h / 2, engaged: false, pressed: false, speed: 0 }
    let lastPx = w / 2
    let lastPy = h / 2

    const setPointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      pointer.tx = clientX - rect.left
      pointer.ty = clientY - rect.top
    }

    const onMove = (e: PointerEvent) => {
      setPointer(e.clientX, e.clientY)
      pointer.engaged = true
    }
    const onDown = (e: PointerEvent) => {
      setPointer(e.clientX, e.clientY)
      pointer.engaged = true
      pointer.pressed = true
    }
    const onUp = () => {
      pointer.pressed = false
    }
    const onLeave = () => {
      pointer.engaged = false
      pointer.pressed = false
    }

    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerdown", onDown)
    window.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointerleave", onLeave)

    const nodes: Node[] = []
    const nodeCount = 18
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        angle: Math.random() * Math.PI * 2,
        radius: 0.55 + Math.random() * 0.9,
        speed: (0.002 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
      })
    }

    const flows: Flow[] = []
    for (let i = 0; i < 18; i++) {
      flows.push({
        t: Math.random(),
        speed: 0.012 + Math.random() * 0.02,
        lateral: (Math.random() - 0.5) * 2,
        surface: Math.random() * Math.PI * 2,
      })
    }

    const bursts: Burst[] = []

    let t = 0
    let raf = 0
    let frame = 0
    let chargeVal = 0
    let resonanceTimer = 0
    let leanX = 0
    let leanY = 0
    let energy = 0.22
    let pulseCount = 0

    const draw = () => {
      t += 0.016
      frame++

      const cxBase = w / 2
      const cyBase = h / 2
      const R = Math.min(w, h)
      const coreBase = R * 0.12

      pointer.x += (pointer.tx - pointer.x) * 0.18
      pointer.y += (pointer.ty - pointer.y) * 0.18
      const pvx = pointer.x - lastPx
      const pvy = pointer.y - lastPy
      pointer.speed = Math.hypot(pvx, pvy)
      lastPx = pointer.x
      lastPy = pointer.y

      const targetLeanX = pointer.engaged ? (pointer.x - cxBase) * 0.08 : 0
      const targetLeanY = pointer.engaged ? (pointer.y - cyBase) * 0.08 : 0
      leanX += (targetLeanX - leanX) * 0.06
      leanY += (targetLeanY - leanY) * 0.06
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
      aura.addColorStop(1, rgba(0))
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
      window.clearInterval(interval)
      ro.disconnect()
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  const statusLabel =
    status === "resonance" ? "Ressonância atingida" : status === "tuning" ? "Sintonizando" : "Em repouso"

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Campo de Ressonância Neural
            </span>
          </div>
          <h1 className="text-balance text-2xl font-semibold text-foreground sm:text-3xl">
            Sintonize a AINEX com o seu toque
          </h1>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Arraste sobre o campo para criar canais de energia até o núcleo da esfera.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                status === "idle" ? "bg-muted-foreground" : "animate-pulse bg-primary",
              )}
            />
            <span className="text-xs font-medium text-foreground">{statusLabel}</span>
          </div>

          <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <Zap className={cn("h-3.5 w-3.5", charge > 0 ? "text-primary" : "text-muted-foreground")} />
            <span className="text-xs font-medium tabular-nums text-foreground">{charge}%</span>
          </div>

          {status === "idle" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm animate-in fade-in-50">
                <Hand className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Toque e arraste para interagir</span>
              </div>
            </div>
          )}

          <div ref={wrapRef} className="relative h-[300px] w-full sm:h-[380px]">
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
          <Metric icon={Waves} label="Pulsos emitidos" value={String(pulses)} />
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
