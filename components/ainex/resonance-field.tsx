"use client"

import { useEffect, useRef, useState } from "react"
import { Zap, Hand, Activity, Waves } from "lucide-react"
import { cn } from "@/lib/utils"

type FieldStatus = "idle" | "tuning" | "resonance"

// Reads an oklch/hex CSS variable and returns an rgb tuple by painting it once.
function resolveColor(varName: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback
  try {
    const ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    if (!value) return fallback
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  } catch {
    return fallback
  }
}

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

  // Live readouts surfaced to React (throttled from the animation loop)
  const [status, setStatus] = useState<FieldStatus>("idle")
  const [charge, setCharge] = useState(0)
  const [sync, setSync] = useState(0)
  const [pulses, setPulses] = useState(0)

  // Shared values written by React-facing throttle and read by UI
  const readout = useRef({ status: "idle" as FieldStatus, charge: 0, sync: 0, pulses: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0

    const resize = () => {
      w = wrap.clientWidth
      h = wrap.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const accent = resolveColor("--primary", [219, 68, 55])
    const [ar, ag, ab] = accent
    const rgba = (a: number) => `rgba(${ar}, ${ag}, ${ab}, ${a})`

    // Pointer state
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, engaged: false, pressed: false, speed: 0 }
    let lastPx = 0
    let lastPy = 0

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

    // Build orbiting synapse nodes
    const nodes: Node[] = []
    const nodeCount = 26
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        angle: Math.random() * Math.PI * 2,
        radius: 0.55 + Math.random() * 0.9,
        speed: (0.002 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
      })
    }

    // Energy channel particles (core <-> pointer)
    const flows: Flow[] = []
    for (let i = 0; i < 28; i++) {
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

      // Ease pointer toward target
      pointer.x += (pointer.tx - pointer.x) * 0.18
      pointer.y += (pointer.ty - pointer.y) * 0.18
      const pvx = pointer.x - lastPx
      const pvy = pointer.y - lastPy
      pointer.speed = Math.hypot(pvx, pvy)
      lastPx = pointer.x
      lastPy = pointer.y

      // Sphere leans toward pointer (gravitational pull), eased
      const targetLeanX = pointer.engaged ? (pointer.x - cxBase) * 0.08 : 0
      const targetLeanY = pointer.engaged ? (pointer.y - cyBase) * 0.08 : 0
      leanX += (targetLeanX - leanX) * 0.06
      leanY += (targetLeanY - leanY) * 0.06
      const cx = cxBase + leanX
      const cy = cyBase + leanY

      // Distance from pointer to core
      const pdx = pointer.x - cx
      const pdy = pointer.y - cy
      const pdist = Math.hypot(pdx, pdy)
      const proximity = pointer.engaged ? Math.max(0, 1 - pdist / (R * 0.6)) : 0

      // Charge accumulates while tuning (engaged + movement + proximity)
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
      const status: FieldStatus = resonant ? "resonance" : tuning ? "tuning" : "idle"

      // Target energy from state
      const targetEnergy = resonant ? 1 : tuning ? 0.55 + proximity * 0.35 : 0.22
      energy += (targetEnergy - energy) * 0.06

      ctx.clearRect(0, 0, w, h)

      const breath = Math.sin(t * 1.4) * 0.5 + 0.5
      const flash = resonant ? Math.max(0, resonanceTimer / 1.3) : 0
      const coreR = coreBase * (1 + breath * 0.06 + energy * 0.14 + flash * 0.4)

      // --- Aura ---
      const auraR = R * (0.34 + breath * 0.02 + energy * 0.06 + flash * 0.12)
      const aura = ctx.createRadialGradient(cx, cy, coreR * 0.4, cx, cy, auraR)
      aura.addColorStop(0, rgba(0.28 + energy * 0.25 + flash * 0.2))
      aura.addColorStop(0.5, rgba(0.1 + energy * 0.08))
      aura.addColorStop(1, rgba(0))
      ctx.fillStyle = aura
      ctx.beginPath()
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2)
      ctx.fill()

      // --- Resonance bursts (expanding shockwaves) ---
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]
        b.t += 0.02
        if (b.t >= 1) {
          bursts.splice(i, 1)
          continue
        }
        const rr = coreR + b.t * R * 0.55
        ctx.strokeStyle = rgba((1 - b.t) * 0.5)
        ctx.lineWidth = 2.5 * (1 - b.t)
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // --- Energy channel: particles streaming between core and pointer ---
      if (tuning) {
        for (const f of flows) {
          f.t += f.speed * (0.6 + proximity)
          if (f.t > 1) f.t -= 1
          // Curved path from a point on the core surface toward the pointer
          const sx = cx + Math.cos(f.surface) * coreR
          const sy = cy + Math.sin(f.surface) * coreR
          const mx = (sx + pointer.x) / 2 + pdy * 0.12 * f.lateral
          const my = (sy + pointer.y) / 2 - pdx * 0.12 * f.lateral
          const u = f.t
          const iu = 1 - u
          // Quadratic bezier
          const x = iu * iu * sx + 2 * iu * u * mx + u * u * pointer.x
          const y = iu * iu * sy + 2 * iu * u * my + u * u * pointer.y
          const fade = Math.sin(u * Math.PI)
          ctx.fillStyle = rgba(fade * (0.4 + proximity * 0.5))
          ctx.beginPath()
          ctx.arc(x, y, 1.6 * fade + 0.6, 0, Math.PI * 2)
          ctx.fill()
        }

        // --- Lightning tendrils from core to pointer ---
        const strands = 3
        for (let s = 0; s < strands; s++) {
          ctx.strokeStyle = rgba((0.18 + proximity * 0.35) * (0.6 + Math.sin(t * 8 + s) * 0.4))
          ctx.lineWidth = 1
          ctx.beginPath()
          const segs = 6
          const baseAngle = Math.atan2(pdy, pdx) + (s - 1) * 0.18
          const sx = cx + Math.cos(baseAngle) * coreR
          const sy = cy + Math.sin(baseAngle) * coreR
          ctx.moveTo(sx, sy)
          for (let k = 1; k <= segs; k++) {
            const u = k / segs
            const bx = sx + (pointer.x - sx) * u
            const by = sy + (pointer.y - sy) * u
            const jitter = (1 - u) * 14 * Math.sin(t * 9 + k * 1.7 + s)
            ctx.lineTo(bx + -pdy / (pdist || 1) * jitter, by + pdx / (pdist || 1) * jitter)
          }
          ctx.stroke()
        }

        // Pointer reticle
        ctx.strokeStyle = rgba(0.5 + proximity * 0.4)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(pointer.x, pointer.y, 10 + Math.sin(t * 6) * 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = rgba(0.6)
        ctx.beginPath()
        ctx.arc(pointer.x, pointer.y, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- Orbiting synapse nodes + connections ---
      const spd = resonant ? 3 : tuning ? 1.8 : 1
      const pos: { x: number; y: number; depth: number }[] = []
      for (const n of nodes) {
        n.angle += n.speed * spd
        const orbit = coreBase + n.radius * R * 0.12
        const x = cx + Math.cos(n.angle) * orbit
        const y = cy + Math.sin(n.angle) * orbit * 0.82
        const depth = (Math.sin(n.angle + n.phase) + 1) / 2
        pos.push({ x, y, depth })
      }
      ctx.lineWidth = 0.6
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const dx = pos[i].x - pos[j].x
          const dy = pos[i].y - pos[j].y
          const d = Math.hypot(dx, dy)
          if (d < R * 0.16) {
            const fire = (Math.sin(t * 3 + i + j) * 0.5 + 0.5) * energy
            ctx.strokeStyle = rgba((1 - d / (R * 0.16)) * (0.04 + fire * 0.3))
            ctx.beginPath()
            ctx.moveTo(pos[i].x, pos[i].y)
            ctx.lineTo(pos[j].x, pos[j].y)
            ctx.stroke()
          }
        }
      }
      for (const p of pos) {
        ctx.fillStyle = rgba((0.3 + p.depth * 0.7) * (0.5 + energy * 0.5))
        ctx.beginPath()
        ctx.arc(p.x, p.y, 0.8 + p.depth * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // --- Charge ring around the sphere ---
      if (chargeVal > 0.01) {
        const ringR = coreR + R * 0.06
        ctx.strokeStyle = rgba(0.12)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = rgba(0.85)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + chargeVal * Math.PI * 2)
        ctx.stroke()
      }

      // --- Core glow ---
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      core.addColorStop(0, `rgba(255,255,255,${0.95})`)
      core.addColorStop(0.35, rgba(0.95))
      core.addColorStop(0.7, rgba(0.5))
      core.addColorStop(1, rgba(0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = `rgba(255,255,255,${0.7 + breath * 0.3})`
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Throttle readouts to React (~10fps)
      if (frame % 6 === 0) {
        readout.current = {
          status,
          charge: Math.round(chargeVal * 100),
          sync: Math.round((0.4 + energy * 0.6) * 100),
          pulses: pulseCount,
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    // Push readouts into React state on an interval (keeps render cheap)
    const interval = window.setInterval(() => {
      setStatus(readout.current.status)
      setCharge(readout.current.charge)
      setSync(readout.current.sync)
      setPulses(readout.current.pulses)
    }, 120)

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
        {/* Heading */}
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
            Arraste sobre o campo para criar canais de energia até o núcleo. A esfera se inclina e responde ao seu
            movimento — mantenha a sintonia para carregar e disparar um pulso de ressonância.
          </p>
        </div>

        {/* Interactive field */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Status chip */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                status === "idle" ? "bg-muted-foreground" : "animate-pulse bg-primary",
              )}
            />
            <span className="text-xs font-medium text-foreground">{statusLabel}</span>
          </div>

          {/* Charge badge */}
          <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <Zap className={cn("h-3.5 w-3.5", charge > 0 ? "text-primary" : "text-muted-foreground")} />
            <span className="text-xs font-medium tabular-nums text-foreground">{charge}%</span>
          </div>

          {/* Idle hint */}
          {status === "idle" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 backdrop-blur-sm animate-in fade-in-50">
                <Hand className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Toque e arraste para sintonizar</span>
              </div>
            </div>
          )}

          <div ref={wrapRef} className="relative h-[340px] w-full sm:h-[440px] lg:h-[480px]">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Campo de ressonância da AINEX, esfera de luz neural interativa"
              className="block h-full w-full cursor-crosshair touch-none"
            />
          </div>
        </div>

        {/* Live telemetry */}
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
