// Fase 16: the mouse trail (estela). One canvas, a fixed pool of particles (never more than
// MAX_PARTICLES), drawn with requestAnimationFrame at up to 60 fps, and only while there
// is something to draw: with no particles left the loop stops.
import { useEffect, useState } from 'react'
import type { MouseStyle, TrailLayer, TrailStyle } from '../../../shared/types'

export const MAX_PARTICLES = 240
const FRAME_MS = 1000 / 60 - 1.5 // up to 60 fps, even on 120 Hz screens

interface Particle {
  active: boolean
  layer: number
  style: TrailStyle
  x: number
  y: number
  px: number // where it came from (rainbow ribbons)
  py: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
  color: string
  rot: number
  spin: number
}

// How far the mouse moves (px) between two particles of each style.
const SPACING: Record<TrailStyle, number> = {
  sparkles: 9,
  stars: 14,
  hearts: 16,
  paws: 24,
  dots: 6,
  bubbles: 14,
  comet: 3,
  rainbow: 4
}
const SIZE: Record<TrailStyle, number> = {
  sparkles: 7,
  stars: 7,
  hearts: 7,
  paws: 6,
  dots: 3.2,
  bubbles: 6,
  comet: 6,
  rainbow: 7
}

// How many particles a style keeps, from "Largo" (1–10), shared with the other style.
export function layerCap(length: number, layers: number): number {
  return Math.min(Math.floor(MAX_PARTICLES / Math.max(1, layers)), 10 + length * 12)
}

export class TrailEngine {
  private readonly pool: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    layer: 0,
    style: 'dots' as TrailStyle,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    born: 0,
    life: 1,
    size: 1,
    color: '#fff',
    rot: 0,
    spin: 0
  }))
  private readonly ctx: CanvasRenderingContext2D | null
  private trail: MouseStyle['trail'] | null = null
  private raf = 0
  private lastFrame = 0
  private lastX: number | null = null
  private lastY = 0
  private travelled = [0, 0]
  private counter = [0, 0]
  private prevEmit: Array<[number, number] | null> = [null, null]
  private hue = 0
  private alive = 0
  private dpr = 1
  private width = 0
  private height = 0
  frames = 0 // drawn frames, for measuring

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
    this.resize()
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr))
  }

  setTrail(trail: MouseStyle['trail'] | null): void {
    this.trail = trail && trail.on && trail.styles.length ? trail : null
    if (!this.trail) this.clear()
  }

  // The mouse moved to (x, y), in the canvas' CSS pixels.
  move(x: number, y: number): void {
    const trail = this.trail
    if (!trail) return
    if (this.lastX === null) {
      this.lastX = x
      this.lastY = y
      return
    }
    const dx = x - this.lastX
    const dy = y - this.lastY
    const dist = Math.hypot(dx, dy)
    if (dist < 0.5) return
    const now = performance.now()
    trail.styles.forEach((layer, i) => {
      const spacing = SPACING[layer.style]
      this.travelled[i] += dist
      let n = Math.min(6, Math.floor(this.travelled[i] / spacing))
      this.travelled[i] -= Math.floor(this.travelled[i] / spacing) * spacing
      while (n-- > 0) {
        const t = 1 - (n * spacing) / dist
        const ex = this.lastX! + dx * Math.max(0, t)
        const ey = this.lastY + dy * Math.max(0, t)
        this.emit(i, layer, ex, ey, dx / dist, dy / dist, now, trail)
      }
    })
    this.lastX = x
    this.lastY = y
    this.start()
  }

  // The mouse left (or the window was hidden): the next move starts a new line.
  lift(): void {
    this.lastX = null
    this.prevEmit = [null, null]
  }

  clear(): void {
    for (const p of this.pool) p.active = false
    this.alive = 0
    this.lift()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  destroy(): void {
    this.clear()
    this.trail = null
  }

  private colorFor(layer: TrailLayer, i: number): string {
    const count = this.counter[i]++
    if (layer.mode === 'rainbow') {
      this.hue = (this.hue + 14) % 360
      return `hsl(${this.hue} 92% 62%)`
    }
    if (layer.mode === 'alternate') return layer.colors[count % layer.colors.length]
    return layer.colors[0]
  }

  private emit(
    i: number,
    layer: TrailLayer,
    x: number,
    y: number,
    ux: number,
    uy: number,
    now: number,
    trail: NonNullable<TrailEngine['trail']>
  ): void {
    const cap = layerCap(trail.length, trail.styles.length)
    let slot: Particle | undefined
    let oldest: Particle | undefined
    let mine = 0
    for (const p of this.pool) {
      if (!p.active) {
        slot ??= p
        continue
      }
      if (p.layer !== i) continue
      mine++
      if (!oldest || p.born < oldest.born) oldest = p
    }
    if (mine >= cap || !slot) slot = oldest ?? slot
    if (!slot) return
    if (!slot.active) this.alive++
    const style = layer.style
    const base = trail.fade === 'fast' ? 420 : 1000
    const lifeBy: Partial<Record<TrailStyle, number>> = { paws: 1.7, comet: 0.55, rainbow: 0.6 }
    const r = Math.random()
    slot.active = true
    slot.layer = i
    slot.style = style
    // Ribbons join each particle to the one before it.
    const prev = this.prevEmit[i]
    slot.px = prev ? prev[0] : x
    slot.py = prev ? prev[1] : y
    this.prevEmit[i] = [x, y]
    slot.x = x
    slot.y = y
    slot.born = now
    slot.life = base * (lifeBy[style] ?? 1) * (0.8 + r * 0.4)
    slot.size = SIZE[style] * (0.75 + r * 0.5)
    slot.color = this.colorFor(layer, i)
    slot.rot = Math.random() * Math.PI * 2
    slot.spin = (Math.random() - 0.5) * 0.006
    slot.vx = (Math.random() - 0.5) * 0.04
    slot.vy = (Math.random() - 0.5) * 0.04
    if (style === 'paws') {
      // Footprints: pointing where the mouse goes, left and right in turns.
      const side = this.counter[i] % 2 ? 1 : -1
      slot.x += -uy * 5 * side
      slot.y += ux * 5 * side
      slot.rot = Math.atan2(uy, ux) + Math.PI / 2
      slot.spin = 0
      slot.vx = slot.vy = 0
    } else if (style === 'hearts' || style === 'bubbles') {
      slot.vy = -0.03 - r * 0.03 // they float up
    } else if (style === 'stars') {
      slot.vy = 0.02 + r * 0.03 // they fall a bit
    } else if (style === 'comet' || style === 'rainbow') {
      slot.vx = slot.vy = 0
    }
  }

  private start(): void {
    if (!this.raf && this.alive > 0) this.raf = requestAnimationFrame(this.tick)
  }

  private readonly tick = (now: number): void => {
    this.raf = 0
    if (now - this.lastFrame < FRAME_MS) {
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    const dt = this.lastFrame ? Math.min(50, now - this.lastFrame) : 16
    this.lastFrame = now
    this.draw(now, dt)
    this.frames++
    if (this.alive > 0) this.raf = requestAnimationFrame(this.tick)
    else this.lastFrame = 0
  }

  private draw(now: number, dt: number): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    let alive = 0
    for (const p of this.pool) {
      if (!p.active) continue
      const age = (now - p.born) / p.life
      if (age >= 1) {
        p.active = false
        continue
      }
      alive++
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      drawParticle(ctx, p, age)
    }
    this.alive = alive
    ctx.globalAlpha = 1
  }
}

function starPath(ctx: CanvasRenderingContext2D, points: number, R: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r : R
    const a = (Math.PI * i) / points - Math.PI / 2
    ctx.lineTo(rad * Math.cos(a), rad * Math.sin(a))
  }
  ctx.closePath()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, age: number): void {
  const fade = 1 - age
  ctx.globalAlpha = fade * fade * 0.95 + 0.05 * fade
  ctx.fillStyle = p.color
  ctx.strokeStyle = p.color
  const s = p.size
  switch (p.style) {
    case 'dots':
      ctx.beginPath()
      ctx.arc(p.x, p.y, s * (0.4 + 0.6 * fade), 0, Math.PI * 2)
      ctx.fill()
      return
    case 'comet':
      ctx.beginPath()
      ctx.arc(p.x, p.y, s * fade + 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha *= 0.25
      ctx.beginPath()
      ctx.arc(p.x, p.y, (s * fade + 0.5) * 2.2, 0, Math.PI * 2)
      ctx.fill()
      return
    case 'rainbow':
      ctx.lineCap = 'round'
      ctx.lineWidth = s * (0.3 + 0.7 * fade)
      ctx.beginPath()
      ctx.moveTo(p.px, p.py)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      return
    case 'bubbles':
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(p.x, p.y, s * (0.6 + 0.6 * age), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha *= 0.7
      ctx.beginPath()
      ctx.arc(p.x - s * 0.3, p.y - s * 0.3, s * 0.18, 0, Math.PI * 2)
      ctx.fill()
      return
  }
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  if (p.style === 'sparkles') {
    const twinkle = 0.6 + 0.4 * Math.sin(age * 14)
    starPath(ctx, 4, s * twinkle, s * twinkle * 0.28)
    ctx.fill()
  } else if (p.style === 'stars') {
    starPath(ctx, 5, s, s * 0.45)
    ctx.fill()
  } else if (p.style === 'hearts') {
    const k = s / 8
    ctx.scale(k, k)
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.bezierCurveTo(-8, 0, -6, -7, 0, -3)
    ctx.bezierCurveTo(6, -7, 8, 0, 0, 6)
    ctx.fill()
  } else if (p.style === 'paws') {
    const k = s / 6
    ctx.scale(k, k)
    ctx.beginPath()
    ctx.ellipse(0, 2, 3.4, 2.8, 0, 0, Math.PI * 2)
    ctx.fill()
    for (const [tx, ty] of [
      [-3.6, -1.8],
      [-1.3, -4.2],
      [1.3, -4.2],
      [3.6, -1.8]
    ]) {
      ctx.beginPath()
      ctx.arc(tx, ty, 1.25, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

// A text field has the focus (the trail waits while you type).
export function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return !['checkbox', 'radio', 'color', 'range', 'button', 'submit', 'file'].includes(type)
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// "Reducir movimiento" (or "Reduce motion") on the computer, followed live.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}
