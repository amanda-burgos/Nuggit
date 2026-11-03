import type { Reminder } from './types'
import { addDays, describeRepeat, isDueOn } from './dailies'

// Fase 12: when a reminder rings. Shared by the main process (which rings them) and the
// Recordatorios widget. Times are local "YYYY-MM-DDTHH:MM" keys, so they compare as text.

const pad = (n: number): string => String(n).padStart(2, '0')

export function localKey(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  const [h, min] = key.slice(11, 16).split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

// The next time it rings, after `after`; null once a one-time reminder already rang.
export function nextOccurrence(
  reminder: Pick<Reminder, 'date' | 'time' | 'repeat' | 'after'>
): string | null {
  const { date, time, repeat, after } = reminder
  if (repeat.kind === 'once') {
    const key = `${date}T${time}`
    return key > after ? key : null
  }
  const afterDay = after.slice(0, 10)
  let day = date > afterDay ? date : afterDay
  // Every repeat rings at least once a year, so this always finds one.
  for (let i = 0; i < 800; i++, day = addDays(day, 1)) {
    if (!isDueOn(repeat, day)) continue
    const key = `${day}T${time}`
    if (key > after) return key
  }
  return null
}

// When it rings next, as a Date: "Posponer" first, if it's earlier.
export function nextRing(reminder: Reminder): Date | null {
  const next = nextOccurrence(reminder)
  const at = next ? keyToDate(next) : null
  const snooze = reminder.snoozeUntil ? new Date(reminder.snoozeUntil) : null
  if (snooze && (!at || snooze < at)) return snooze
  return at
}

// "9:00", "16:30".
export function formatTime(time: string): string {
  const [h, m] = time.split(':')
  return `${Number(h)}:${m}`
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// "Hoy 9:00", "Mañana 18:30", "El jueves 7:00", "12 nov 9:00".
export function describeWhen(at: Date, now = new Date()): string {
  const key = localKey(at)
  const day = key.slice(0, 10)
  const today = localKey(now).slice(0, 10)
  const time = formatTime(key.slice(11, 16))
  if (day === today) return `Hoy ${time}`
  if (day === addDays(today, 1)) return `Mañana ${time}`
  if (day > today && day < addDays(today, 7)) return `El ${WEEKDAYS[at.getDay()]} ${time}`
  const year = at.getFullYear() !== now.getFullYear() ? ` ${at.getFullYear()}` : ''
  return `${at.getDate()} ${MONTHS[at.getMonth()]}${year} ${time}`
}

// "Una vez", "Todos los días", "Lun, Mié y Vie"…
export function describeReminderRepeat(repeat: Reminder['repeat']): string {
  return repeat.kind === 'once' ? 'Una vez' : describeRepeat(repeat)
}
