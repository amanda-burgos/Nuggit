import { useEffect, useState } from 'react'
import type { NextActionState } from '../../../shared/types'

// What the user told Next Action today (skips, time available). The main process keeps it,
// so the widget, its detached window and the menu bar all show the same thing.
export function useNextAction(): NextActionState | null {
  const [state, setState] = useState<NextActionState | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.nextAction.onChange(setState)
    window.api.nextAction
      .load()
      .then((loaded) => {
        if (!cancelled) setState((prev) => prev ?? loaded)
      })
      .catch((err) => console.error('Could not load Next Action', err))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
