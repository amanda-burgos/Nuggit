import { useEffect, useState } from 'react'
import type { QotdState } from '../../../shared/types'

// Fase 11: your answers to the question of the day. The main process keeps them, so every
// window shows the same ones.
export function useQotd(): QotdState | null {
  const [state, setState] = useState<QotdState | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.qotd.onChange(setState)
    window.api.qotd
      .load()
      .then((loaded) => {
        if (!cancelled) setState((prev) => prev ?? loaded)
      })
      .catch((err) => {
        console.error('Could not load the questions of the day', err)
        if (!cancelled) setState((prev) => prev ?? {})
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
