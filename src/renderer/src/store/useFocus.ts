import { useEffect, useState } from 'react'
import type { FocusState } from '../../../shared/types'

// The Focus timer (SPEC 9.8). The main process runs it, so every window shows the same.
export function useFocus(): FocusState | null {
  const [state, setState] = useState<FocusState | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.focus.onChange(setState)
    window.api.focus
      .load()
      .then((loaded) => {
        if (!cancelled) setState((prev) => prev ?? loaded)
      })
      .catch((err) => console.error('Could not load Focus', err))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}

// Time left in the current phase, refreshed several times a second while it runs.
export function useTimeLeft(state: FocusState | null): number {
  const [now, setNow] = useState(() => Date.now())
  const running = Boolean(state?.endsAt)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  if (!state || state.phase === 'idle') return 0
  if (state.pausedLeftMs !== null) return state.pausedLeftMs
  return state.endsAt ? Math.max(0, Date.parse(state.endsAt) - now) : 0
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
