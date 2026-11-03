import { useEffect, useState } from 'react'
import type { Reminder } from '../../../shared/types'

// Fase 12: the reminders. The main process keeps (and rings) them, so every window shows
// the same ones.
export function useReminders(): Reminder[] | null {
  const [reminders, setReminders] = useState<Reminder[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.reminders.onChange(setReminders)
    window.api.reminders
      .load()
      .then((loaded) => {
        if (!cancelled) setReminders((prev) => prev ?? loaded)
      })
      .catch((err) => {
        console.error('Could not load the reminders', err)
        if (!cancelled) setReminders((prev) => prev ?? [])
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return reminders
}

// Re-renders every 30 s, so "Hoy 9:00" and what already rang stay right.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}
