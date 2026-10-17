import { useEffect, useState } from 'react'
import type { Daily } from '../../../shared/types'

// The dailies (SPEC 9.13). The main process keeps them and makes today's tasks from them,
// so every window shows the same list.
export function useDailies(): Daily[] | null {
  const [dailies, setDailies] = useState<Daily[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.dailies.onChange(setDailies)
    window.api.dailies
      .load()
      .then((loaded) => {
        if (!cancelled) setDailies((prev) => prev ?? loaded)
      })
      .catch((err) => {
        console.error('Could not load dailies', err)
        if (!cancelled) setDailies((prev) => prev ?? [])
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return dailies
}
