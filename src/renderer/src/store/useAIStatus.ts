import { useEffect, useState } from 'react'
import type { AIStatus } from '../../../shared/types'

// What Dip can use right now. The main process checks it (and whether Ollama is open)
// and sends every change to all windows.
export function useAIStatus(): AIStatus | null {
  const [status, setStatus] = useState<AIStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.ai.onStatusChange(setStatus)
    window.api.ai
      .status()
      .then((loaded) => {
        if (!cancelled) setStatus((prev) => prev ?? loaded)
      })
      .catch((err) => console.error('Could not load AI status', err))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return status
}
