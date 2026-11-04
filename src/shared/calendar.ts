import type { CalendarEvent, Daily, DailyRepeat, Task } from './types'
import { addDays, isDueOn } from './dailies'
import { t } from './i18n'

// SPEC 9.14: what goes on each day of Nuggit's calendar, and how Nuggit's tasks and dailies
// become calendar entries for the Mac (and any app that reads .ics). Shared and pure, so
// the calendar view, the .ics feed and the Apple Calendar sync all agree (and it's tested).

export type DayItem =
  | { kind: 'task'; task: Task }
  | { kind: 'daily'; daily: Daily; done: boolean }
  | { kind: 'event'; event: CalendarEvent }

const localDate = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Every day from `from` to `to` (both YYYY-MM-DD, inclusive) with what happens on it.
// Timed things first (by time), then the rest.
export function itemsByDay(
  from: string,
  to: string,
  tasks: Task[],
  dailies: Daily[],
  events: CalendarEvent[]
): Map<string, DayItem[]> {
  const days = new Map<string, DayItem[]>()
  for (let day = from; day <= to; day = addDays(day, 1)) days.set(day, [])
  const add = (day: string, item: DayItem): void => {
    days.get(day)?.push(item)
  }

  // Today's copy of a daily is a task too: the daily itself is shown instead.
  for (const task of tasks) {
    if (task.dueDate && !task.dailyId) add(task.dueDate, { kind: 'task', task })
  }
  for (const daily of dailies) {
    const since = localDate(daily.createdAt)
    for (const day of days.keys()) {
      if (day >= since && isDueOn(daily.repeat, day)) {
        add(day, { kind: 'daily', daily, done: daily.done.includes(day) })
      }
    }
  }
  for (const event of events) {
    const first = localDate(event.start)
    // An all-day event ends at midnight of the day after its last day.
    const last = event.allDay ? addDays(localDate(event.end), -1) : localDate(event.end)
    for (let day = first; day <= (last < first ? first : last); day = addDays(day, 1)) {
      if (day >= from && day <= to) add(day, { kind: 'event', event })
    }
  }
  for (const list of days.values()) list.sort((a, b) => timeOf(a).localeCompare(timeOf(b)))
  return days
}

function timeOf(item: DayItem): string {
  if (item.kind === 'daily') return item.daily.time ?? '99'
  if (item.kind === 'event') {
    if (item.event.allDay) return '00'
    const d = new Date(item.event.start)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return '98' // tasks have a day, not a time
}

// --- Nuggit's own entries, for the Mac's calendar ---

// One entry for the Mac's calendar: a task's day, or a daily as a repeating event.
export interface CalendarEntry {
  key: string // "task:<id>" or "daily:<id>": how Nuggit finds its own events again
  title: string
  date: string // YYYY-MM-DD (first day, for a daily)
  time?: string // HH:MM; no time = all day
  minutes: number // length when it has a time
  rrule?: string // RFC 5545 repeat rule, e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
  note: string
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function repeatRule(repeat: DailyRepeat): string {
  if (repeat.kind === 'every-day') return 'FREQ=DAILY'
  if (repeat.kind === 'every-n') return `FREQ=DAILY;INTERVAL=${repeat.n}`
  return `FREQ=WEEKLY;BYDAY=${[...repeat.days]
    .sort()
    .map((d) => BYDAY[d])
    .join(',')}`
}

// The first day the daily is due, from the day it was made (calendars count the start day
// as an occurrence even if the rule says otherwise, so it must match).
function firstDue(daily: Daily): string {
  if (daily.repeat.kind === 'every-n') return daily.repeat.start
  let day = localDate(daily.createdAt)
  for (let i = 0; i < 7 && !isDueOn(daily.repeat, day); i++) day = addDays(day, 1)
  return day
}

// Pending tasks with a date (not today's copies of dailies), and every daily.
export function calendarEntries(tasks: Task[], dailies: Daily[]): CalendarEntry[] {
  const entries: CalendarEntry[] = []
  for (const task of tasks) {
    if (!task.dueDate || task.status === 'done' || task.dailyId) continue
    entries.push({
      key: `task:${task.id}`,
      title: task.title,
      date: task.dueDate,
      minutes: task.estimateMin ?? 30,
      note: t('Tarea de Nuggit', 'Nuggit task')
    })
  }
  for (const daily of dailies) {
    entries.push({
      key: `daily:${daily.id}`,
      title: daily.title,
      date: firstDue(daily),
      ...(daily.time ? { time: daily.time } : {}),
      minutes: daily.estimateMin ?? 30,
      rrule: repeatRule(daily.repeat),
      note: t('Daily de Nuggit', 'Nuggit daily')
    })
  }
  return entries
}

// --- .ics (Paso 1: Apple Calendar, Google Calendar and any calendar app) ---

const compact = (date: string): string => date.replace(/-/g, '')

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Lines longer than 75 bytes continue on the next line, starting with a space.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const n = new TextEncoder().encode(char).length
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += n
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function endOf(entry: CalendarEntry): string {
  const [h, m] = entry.time!.split(':').map(Number)
  const total = h * 60 + m + entry.minutes
  const day = addDays(entry.date, Math.floor(total / 1440))
  const rest = total % 1440
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${compact(day)}T${pad(Math.floor(rest / 60))}${pad(rest % 60)}00`
}

export function buildIcs(entries: CalendarEntry[], now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nuggit//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Nuggit',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M'
  ]
  for (const entry of entries) {
    lines.push('BEGIN:VEVENT', `UID:${entry.key.replace(':', '-')}@nuggit.app`, `DTSTAMP:${stamp}`)
    if (entry.time) {
      // Floating local time: the same hour wherever the Mac is.
      lines.push(`DTSTART:${compact(entry.date)}T${entry.time.replace(':', '')}00`)
      lines.push(`DTEND:${endOf(entry)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(entry.date)}`)
      lines.push(`DTEND;VALUE=DATE:${compact(addDays(entry.date, 1))}`)
    }
    if (entry.rrule) lines.push(`RRULE:${entry.rrule}`)
    lines.push(`SUMMARY:${escapeText(entry.title)}`, `DESCRIPTION:${escapeText(entry.note)}`)
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
