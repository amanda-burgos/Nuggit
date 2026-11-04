import { useEffect, useRef } from 'react'
import type { MouseStyle } from '../../../shared/types'
import { useFocus } from '../store/useFocus'
import { TrailEngine, isTyping, useReducedMotion } from './mouseTrail'

// Fase 16: the saved trail, in this window. AppearanceRoot only mounts it with the trail on.
// It pauses while the window is hidden or not in front, while you type (optional) and
// during a Focus round (optional); with "Reducir movimiento" it doesn't draw at all.
export function MouseTrailLayer({ mouse }: { mouse: MouseStyle }): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const focus = useFocus()
  const inFocus = mouse.focusPause && focus?.phase === 'focus'
  const reduced = useReducedMotion()
  const off = reduced || inFocus

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || off) return
    const engine = new TrailEngine(canvas)
    engine.setTrail(mouse.trail)
    let paused = document.hidden || !document.hasFocus()

    const onMove = (e: PointerEvent): void => {
      if (paused || (mouse.typingPause && isTyping())) return engine.lift()
      // The dress-up's preview draws its own (unsaved) trail.
      if ((e.target as Element | null)?.closest?.('[data-mouse-preview]')) return engine.lift()
      engine.move(e.clientX, e.clientY)
    }
    const pause = (): void => {
      paused = true
      engine.clear()
    }
    const resume = (): void => {
      paused = document.hidden
    }
    const onVisibility = (): void => (document.hidden ? pause() : resume())
    const onResize = (): void => engine.resize()
    const onLeave = (): void => engine.lift()

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', pause)
    window.addEventListener('focus', resume)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    document.documentElement.addEventListener('pointerleave', onLeave)
    // For measuring: how many frames the trail has drawn.
    ;(window as unknown as { __nuggitTrail?: TrailEngine }).__nuggitTrail = engine
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', pause)
      window.removeEventListener('focus', resume)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      engine.destroy()
    }
  }, [mouse, off])

  if (off) return null
  return <canvas ref={canvasRef} className="mouse-trail-canvas" aria-hidden="true" />
}
