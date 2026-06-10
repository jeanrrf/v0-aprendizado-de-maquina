"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export type AinexState = "idle" | "listening" | "thinking" | "speaking"

interface AinexOrbProps {
  size?: number
  state?: AinexState
  className?: string
}

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  phase: number
  z: number
}

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

export function AinexOrb({ size = 64, state = "idle", className }: AinexOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<AinexState>(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const accent = resolveColor("--primary", [219, 68, 55])
    const [ar, ag, ab] = accent
    const rgba = (a: number) => `rgba(${ar}, ${ag}, ${ab}, ${a})`

    const cx = size / 2
    const cy = size / 2
    const baseCore = size * 0.22

    // Build orbiting synapse particles
    const particles: Particle[] = []
    const count = Math.round(size / 4)
    for (let i = 0; i < count; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: baseCore + size * (0.12 + Math.random() * 0.22),
        speed: (0.002 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1),
        size: 0.6 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        z: Math.random(),
      })
    }

    let t = 0
    let raf = 0

    // Eased animated values
    let energy = 0 // 0..1 overall activity
    let pulse = 0

    const speedFor = (s: AinexState) => (s === "thinking" ? 3 : s === "speaking" ? 2.2 : s === "listening" ? 1.3 : 1)
    const targetEnergy = (s: AinexState) =>
      s === "thinking" ? 1 : s === "speaking" ? 0.85 : s === "listening" ? 0.5 : 0.22

    const draw = () => {
      const s = stateRef.current
      const spd = speedFor(s)
      energy += (targetEnergy(s) - energy) * 0.05
      t += 0.016 * spd

      ctx.clearRect(0, 0, size, size)

      // Breathing pulse
      const breath = Math.sin(t * 1.4) * 0.5 + 0.5
      pulse = breath
      const coreRadius = baseCore * (1 + breath * (0.06 + energy * 0.12))

      // Outer aura glow
      const auraR = size * (0.46 + breath * 0.04 + energy * 0.04)
      const aura = ctx.createRadialGradient(cx, cy, coreRadius * 0.4, cx, cy, auraR)
      aura.addColorStop(0, rgba(0.32 + energy * 0.25))
      aura.addColorStop(0.5, rgba(0.12 + energy * 0.1))
      aura.addColorStop(1, rgba(0))
      ctx.fillStyle = aura
      ctx.beginPath()
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2)
      ctx.fill()

      // Speaking concentric ripples
      if (s === "speaking") {
        for (let i = 0; i < 3; i++) {
          const rp = ((t * 0.5 + i / 3) % 1)
          ctx.strokeStyle = rgba((1 - rp) * 0.4)
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(cx, cy, coreRadius + rp * size * 0.4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Synapse connections + nodes
      ctx.lineWidth = 0.6
      const positions: { x: number; y: number; depth: number; bright: number }[] = []
      for (const p of particles) {
        p.angle += p.speed * spd
        // pseudo-3D: vary radius with a tilt to feel volumetric
        const tilt = Math.sin(p.angle + p.phase) * 0.35
        const r = p.radius * (1 + tilt * 0.15)
        const x = cx + Math.cos(p.angle) * r
        const y = cy + Math.sin(p.angle) * r * 0.78
        const depth = (Math.sin(p.angle + p.phase) + 1) / 2 // 0 back .. 1 front
        const bright = 0.25 + depth * 0.75
        positions.push({ x, y, depth, bright })
      }

      // connect nearby nodes (sinapses firing with energy)
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i]
          const b = positions[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < size * 0.22) {
            const fire = (Math.sin(t * 3 + i + j) * 0.5 + 0.5) * energy
            const alpha = (1 - dist / (size * 0.22)) * (0.05 + fire * 0.35)
            ctx.strokeStyle = rgba(alpha)
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // draw nodes
      for (const pos of positions) {
        const ns = (0.6 + pos.depth) * 1.4
        ctx.fillStyle = rgba(pos.bright * (0.5 + energy * 0.5))
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, ns, 0, Math.PI * 2)
        ctx.fill()
      }

      // Core glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius)
      core.addColorStop(0, `rgba(255,255,255,${0.95})`)
      core.addColorStop(0.35, rgba(0.95))
      core.addColorStop(0.7, rgba(0.55))
      core.addColorStop(1, rgba(0))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
      ctx.fill()

      // Hot center point
      ctx.fillStyle = `rgba(255,255,255,${0.7 + pulse * 0.3})`
      ctx.beginPath()
      ctx.arc(cx, cy, coreRadius * 0.32, 0, Math.PI * 2)
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="AINEX, esfera de luz neural"
      className={cn("block", className)}
      style={{ width: size, height: size }}
    />
  )
}
