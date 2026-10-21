import { execFile } from 'child_process'
import type { CalendarEntry } from '../../shared/calendar'
import type { CalendarEvent } from '../../shared/types'

// SPEC 9.14, Paso 2: two ways with the Mac's Calendar app, through its scripting interface
// (JavaScript for Automation, the same as AppleScript). macOS asks once whether Nuggit may
// control Calendar. Nuggit only ever writes in its own "Nuggit" calendar; the person's
// other calendars are only read, never changed.

export const NUGGIT_CALENDAR = 'Nuggit'
const TIMEOUT_MS = 60_000

export class CalendarAccessError extends Error {}

function runJxa(script: string, input: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', script, JSON.stringify(input)],
      { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout.trim())
        // -1743: the person said no (or hasn't been asked in a way that can show).
        if (/-1743|not allowed|no autorizado/i.test(stderr)) {
          return reject(new CalendarAccessError(stderr.trim()))
        }
        reject(new Error(stderr.trim() || err.message))
      }
    )
  })
}

const LIST = `
function run() {
  const Cal = Application('Calendar')
  return JSON.stringify(Cal.calendars.name())
}`

export async function listCalendars(): Promise<string[]> {
  const names = JSON.parse(await runJxa(LIST, null)) as unknown
  return Array.isArray(names) ? [...new Set(names.filter((n) => typeof n === 'string'))] : []
}

// Events that overlap the range, read in bulk (one request per property, not per event).
// Repeating events show on the day their series started: Calendar's scripting interface
// doesn't list each repetition.
const READ = `
function run(argv) {
  const input = JSON.parse(argv[0])
  const Cal = Application('Calendar')
  const from = new Date(input.from), to = new Date(input.to)
  const out = []
  for (const name of input.names) {
    for (const cal of Cal.calendars.whose({ name: name })()) {
      const evs = cal.events.whose({ _and: [{ startDate: { _lessThan: to } }, { endDate: { _greaterThan: from } }] })
      const ids = evs.uid(), titles = evs.summary(), starts = evs.startDate(), ends = evs.endDate(), allDay = evs.alldayEvent()
      for (let i = 0; i < ids.length; i++) {
        out.push({ id: ids[i], title: titles[i] || '', start: starts[i].toISOString(), end: ends[i].toISOString(), allDay: allDay[i], calendar: name })
      }
    }
  }
  return JSON.stringify(out)
}`

export async function readEvents(names: string[], from: Date, to: Date): Promise<CalendarEvent[]> {
  if (!names.length) return []
  const raw = JSON.parse(
    await runJxa(READ, { names, from: from.toISOString(), to: to.toISOString() })
  ) as unknown
  return Array.isArray(raw) ? (raw as CalendarEvent[]) : []
}

// What Nuggit last wrote for an entry, to tell its own changes from the person's.
export interface WrittenEntry {
  date: string
  title: string
  time?: string
  rrule?: string
}

export interface SyncResult {
  moved: Array<{ key: string; date: string }> // the person moved it to another day there
  created: number
  updated: number
  removed: number
}

// Keeps the "Nuggit" calendar the same as Nuggit: creates, updates and removes Nuggit's
// own events (found by the "(nuggit:task:…)" mark in their notes). If an event was moved
// to another day in Calendar since Nuggit wrote it, it is left as the person put it and
// reported, so Nuggit can move the task too.
const SYNC = `
function run(argv) {
  const input = JSON.parse(argv[0])
  const Cal = Application('Calendar')
  let cal = Cal.calendars.whose({ name: input.calendar })()[0]
  if (!cal) {
    Cal.calendars.push(Cal.Calendar({ name: input.calendar }))
    cal = Cal.calendars.whose({ name: input.calendar })()[0]
  }
  const pad = (n) => String(n).padStart(2, '0')
  const day = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  const at = (date, time) => {
    const [y, m, d] = date.split('-').map(Number)
    const [h, mi] = (time || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, mi)
  }
  const existing = {}
  const notes = cal.events.description(), uids = cal.events.uid(), starts = cal.events.startDate()
  for (let i = 0; i < uids.length; i++) {
    const mark = /\\(nuggit:([a-z]+:[A-Za-z0-9-]+)\\)/.exec(notes[i] || '')
    if (mark) existing[mark[1]] = { uid: uids[i], date: day(starts[i]) }
  }
  const result = { moved: [], created: 0, updated: 0, removed: 0 }
  const props = (e) => {
    const start = at(e.date, e.time)
    const end = e.time ? new Date(start.getTime() + e.minutes * 60000) : at(e.date, '00:00')
    if (!e.time) end.setDate(end.getDate() + 1)
    return {
      summary: e.title,
      startDate: start,
      endDate: end,
      alldayEvent: !e.time,
      recurrence: e.rrule || '',
      description: e.note + '\\n\\n(nuggit:' + e.key + ')'
    }
  }
  for (const e of input.entries) {
    const found = existing[e.key]
    delete existing[e.key]
    if (!found) {
      cal.events.push(Cal.Event(props(e)))
      result.created++
      continue
    }
    const last = input.written[e.key]
    if (e.key.startsWith('task:') && last && found.date !== last.date && found.date !== e.date) {
      result.moved.push({ key: e.key, date: found.date })
      continue
    }
    const same = last && last.date === e.date && last.title === e.title && last.time === e.time && last.rrule === e.rrule
    if (same && found.date === e.date) continue
    const ev = cal.events.whose({ uid: found.uid })()[0]
    const p = props(e)
    ev.summary = p.summary
    ev.alldayEvent = p.alldayEvent
    // The start can't go after the current end (or the other way round): try both orders.
    try { ev.startDate = p.startDate; ev.endDate = p.endDate } catch (x) { ev.endDate = p.endDate; ev.startDate = p.startDate }
    ev.recurrence = p.recurrence
    ev.description = p.description
    result.updated++
  }
  for (const key in existing) {
    cal.events.whose({ uid: existing[key].uid })()[0].delete()
    result.removed++
  }
  return JSON.stringify(result)
}`

export async function syncNuggitCalendar(
  entries: CalendarEntry[],
  written: Record<string, WrittenEntry>
): Promise<SyncResult> {
  return JSON.parse(
    await runJxa(SYNC, { calendar: NUGGIT_CALENDAR, entries, written })
  ) as SyncResult
}
