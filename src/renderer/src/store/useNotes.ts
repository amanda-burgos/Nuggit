import { useEffect, useState } from 'react'
import type { Note } from '../../../shared/types'

// Quick notes (SPEC 9.7). The main process keeps them, so every window shows the same ones.
export function useNotes(): Note[] | null {
  const [notes, setNotes] = useState<Note[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.notes.onChange(setNotes)
    window.api.notes
      .load()
      .then((loaded) => {
        if (!cancelled) setNotes((prev) => prev ?? loaded)
      })
      .catch((err) => {
        console.error('Could not load notes', err)
        if (!cancelled) setNotes((prev) => prev ?? [])
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return notes
}

// "Nota rápida" (⌘N) creates a note and opens the Notas tab: that tab's widget isn't
// mounted yet, so the note to focus waits here until it is.
let pendingFocus: string | null = null
const focusListeners = new Set<() => void>()

export function requestNoteFocus(id: string): void {
  pendingFocus = id
  for (const listener of focusListeners) listener()
}

export function takeNoteFocus(): string | null {
  const id = pendingFocus
  pendingFocus = null
  return id
}

export function onNoteFocusRequest(listener: () => void): () => void {
  focusListeners.add(listener)
  return () => focusListeners.delete(listener)
}

// Creates an empty note and asks the Notas tab to focus it.
export async function newQuickNote(): Promise<void> {
  const note = await window.api.notes.create()
  requestNoteFocus(note.id)
}
