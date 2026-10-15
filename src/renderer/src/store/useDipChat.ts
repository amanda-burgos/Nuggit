import { useEffect, useState } from 'react'
import type { DipChatState } from '../../../shared/types'

// The conversation with Dip. The main process keeps it (and saves it), so the Dip widget,
// its detached window and the Dip tab all show the same chat.
export function useDipChat(): DipChatState | null {
  const [state, setState] = useState<DipChatState | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.dipChat.onChange(setState)
    window.api.dipChat
      .load()
      .then((loaded) => {
        if (!cancelled) setState((prev) => prev ?? loaded)
      })
      .catch((err) => console.error('Could not load the Dip chat', err))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
