import { useEffect, useState } from 'react'
import type { CalendarEvent } from '../../../shared/types'

// Events from the Mac's calendars for the days shown (SPEC 9.14). Empty when the Mac's
// Calendar isn't connected; reloaded when it changes.
export function useCalendarEvents(from: string, to: string): CalendarEvent[] {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => window.api.calendar.onChange(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    let cancelled = false
    window.api.calendar
      .events(from, to)
      .then((loaded) => {
        if (!cancelled) setEvents(loaded)
      })
      .catch((err) => console.error('Could not load calendar events', err))
    return () => {
      cancelled = true
    }
  }, [from, to, version])

  return events
}
