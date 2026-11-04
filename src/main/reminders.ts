import { BrowserWindow, Notification, powerMonitor } from 'electron'
import { randomUUID } from 'crypto'
import type { Reminder, ReminderRepeat } from '../shared/types'
import { formatTime, keyToDate, localKey, nextOccurrence, nextRing } from '../shared/reminders'
import { readJson, writeJson } from './storage/jsonStore'
import { t } from '../shared/i18n'

// Fase 12: reminders. They live here (reminders.json) and ring as a system notice at their
// time, even with every window closed: Nuggit only has to be open (in the menu bar is
// enough). One notice per time, never more.

const MAX_REMINDERS = 200
const MAX_TITLE = 200
const MAX_SNOOZE_MIN = 24 * 60
const MISSED_WINDOW_MS = 12 * 3_600_000 // rang while Nuggit was closed: still told, if this recent
const MAX_WAIT_MS = 3_600_000 // wake up at least every hour (sleep, clock changes)
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const KEY = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

let reminders: Reminder[] = []
let loaded = false
let timer: ReturnType<typeof setTimeout> | null = null
let openTab: (tab: string) => void = () => undefined
// Kept so their click still works (a collected notice loses its events).
const shown = new Set<Notification>()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const isIso = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

// Now minus a minute: a reminder set for this very minute still rings.
const startKey = (): string => localKey(new Date(Date.now() - 60_000))

function cleanRepeat(value: unknown, date: string): ReminderRepeat | null {
  if (!isObject(value)) return null
  if (value.kind === 'once' || value.kind === 'every-day') return { kind: value.kind }
  if (value.kind === 'weekdays' && Array.isArray(value.days)) {
    const days = [...new Set(value.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (days.length === 7) return { kind: 'every-day' }
    return days.length ? { kind: 'weekdays', days: (days as number[]).sort() } : null
  }
  if (value.kind === 'every-n' && Number.isInteger(value.n)) {
    const n = Math.min(Math.max(value.n as number, 1), 365)
    // "Every n days" counts from the reminder's first day.
    return n === 1 ? { kind: 'every-day' } : { kind: 'every-n', n, start: date }
  }
  return null
}

function cleanReminder(value: unknown): Reminder | null {
  if (!isObject(value)) return null
  const { id, title, date, time, after } = value
  if (typeof id !== 'string' || typeof title !== 'string' || !title.trim()) return null
  if (typeof date !== 'string' || !DATE.test(date)) return null
  if (typeof time !== 'string' || !TIME.test(time)) return null
  const repeat = cleanRepeat(value.repeat, date)
  if (!repeat) return null
  const now = new Date().toISOString()
  const reminder: Reminder = {
    id: id.slice(0, 60),
    title: title.trim().slice(0, MAX_TITLE),
    date,
    time,
    repeat,
    after: typeof after === 'string' && KEY.test(after) ? after : startKey(),
    createdAt: isIso(value.createdAt) ? value.createdAt : now,
    updatedAt: isIso(value.updatedAt) ? value.updatedAt : now
  }
  if (isIso(value.snoozeUntil)) reminder.snoozeUntil = value.snoozeUntil
  if (isIso(value.rangAt)) reminder.rangAt = value.rangAt
  return reminder
}

function commit(next: Reminder[]): void {
  reminders = next
  if (loaded) {
    writeJson('reminders', { version: 1, reminders: next }).catch((err) =>
      console.error('[reminders] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('reminders:changed', next)
  schedule()
}

// --- Ringing ---

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  const notice = new Notification({ title, body, silent: false })
  shown.add(notice)
  notice.on('click', () => {
    shown.delete(notice)
    openTab('reminders')
  })
  notice.on('close', () => shown.delete(notice))
  notice.show()
}

// Rings whatever is due. Times missed while Nuggit was closed (or the Mac asleep) ring
// once, saying when they were, if they're recent; older ones are just skipped.
function check(): void {
  const now = Date.now()
  const nowKey = localKey(new Date(now))
  const rung: Array<{ reminder: Reminder; at: Date; late: boolean }> = []
  const next = reminders.map((r) => {
    const snooze = r.snoozeUntil ? Date.parse(r.snoozeUntil) : null
    const occurrence = nextOccurrence(r)
    const at = occurrence ? keyToDate(occurrence) : null
    const snoozeDue = snooze !== null && snooze <= now
    const timeDue = at !== null && at.getTime() <= now
    if (!snoozeDue && !timeDue) return r
    // The latest of the two is the one that counts.
    const when = new Date(Math.max(snoozeDue ? snooze : 0, timeDue ? at.getTime() : 0))
    if (now - when.getTime() <= MISSED_WINDOW_MS) {
      rung.push({ reminder: r, at: when, late: now - when.getTime() > 2 * 60_000 })
    }
    const updated: Reminder = { ...r, rangAt: new Date(now).toISOString() }
    if (timeDue) updated.after = nowKey // every time up to now is done, even several missed
    if (snoozeDue) delete updated.snoozeUntil
    return updated
  })
  if (!rung.length) return schedule()

  if (rung.length === 1) {
    const [{ reminder, at, late }] = rung
    const time = formatTime(localKey(at).slice(11))
    notify(
      `⏰ ${reminder.title}`,
      late
        ? t(`Era a las ${time}.`, `It was at ${time}.`)
        : t('Recordatorio de Nuggit', 'Nuggit reminder')
    )
  } else {
    notify(
      t(`⏰ ${rung.length} recordatorios`, `⏰ ${rung.length} reminders`),
      rung
        .map((r) => r.reminder.title)
        .join(' · ')
        .slice(0, 200)
    )
  }
  commit(next)
}

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = null
  const times = reminders.map(nextRing).filter((d): d is Date => d !== null)
  if (!times.length) return
  const soonest = Math.min(...times.map((d) => d.getTime()))
  const wait = Math.min(Math.max(0, soonest - Date.now()) + 200, MAX_WAIT_MS)
  timer = setTimeout(check, wait)
}

export async function initReminders(options: { openTab(tab: string): void }): Promise<void> {
  openTab = options.openTab
  const data = await readJson<unknown>('reminders', null)
  const saved = isObject(data) && Array.isArray(data.reminders) ? data.reminders : []
  const seen = new Set<string>()
  reminders = saved
    .map(cleanReminder)
    .filter((r): r is Reminder => r !== null && !seen.has(r.id) && Boolean(seen.add(r.id)))
    .slice(0, MAX_REMINDERS)
  loaded = true
  // After sleeping, the timer may be late: look right away.
  powerMonitor.on('resume', check)
  check()
}

// --- Changes ---

export function getReminders(): Reminder[] {
  return reminders
}

export function createReminder(input: unknown): Reminder | null {
  if (!isObject(input) || reminders.length >= MAX_REMINDERS) return null
  const now = new Date().toISOString()
  const reminder = cleanReminder({
    ...input,
    id: randomUUID(),
    after: startKey(),
    createdAt: now,
    updatedAt: now,
    snoozeUntil: undefined,
    rangAt: undefined
  })
  if (!reminder) return null
  commit([...reminders, reminder])
  return reminder
}

// Changing the day, time or repeat starts it over from now (it rings at its new time).
export function updateReminder(id: unknown, patch: unknown): void {
  const current = reminders.find((r) => r.id === id)
  if (!current || !isObject(patch)) return
  const merged = {
    ...current,
    ...Object.fromEntries(
      ['title', 'date', 'time', 'repeat']
        .filter((k) => patch[k] !== undefined)
        .map((k) => [k, patch[k]])
    )
  }
  const clean = cleanReminder(merged)
  if (!clean) return
  const moved =
    clean.date !== current.date ||
    clean.time !== current.time ||
    JSON.stringify(clean.repeat) !== JSON.stringify(current.repeat)
  const updated: Reminder = { ...clean, updatedAt: new Date().toISOString() }
  if (moved) {
    updated.after = startKey()
    delete updated.snoozeUntil
    delete updated.rangAt
  }
  commit(reminders.map((r) => (r.id === current.id ? updated : r)))
}

// Returns what was removed, to put back with restoreReminders (Deshacer).
export function removeReminders(ids: unknown): Reminder[] {
  if (!Array.isArray(ids)) return []
  const removed = reminders.filter((r) => ids.includes(r.id))
  if (removed.length) commit(reminders.filter((r) => !ids.includes(r.id)))
  return removed
}

export function restoreReminders(list: unknown): void {
  if (!Array.isArray(list)) return
  const ids = new Set(reminders.map((r) => r.id))
  const back = list.map(cleanReminder).filter((r): r is Reminder => r !== null && !ids.has(r.id))
  if (back.length) commit([...reminders, ...back].slice(0, MAX_REMINDERS))
}

// "Posponer": rings again in that many minutes.
export function snoozeReminder(id: unknown, minutes: unknown): void {
  const current = reminders.find((r) => r.id === id)
  if (!current || typeof minutes !== 'number' || !Number.isFinite(minutes)) return
  const min = Math.min(Math.max(Math.round(minutes), 1), MAX_SNOOZE_MIN)
  const snoozeUntil = new Date(Date.now() + min * 60_000).toISOString()
  commit(reminders.map((r) => (r.id === current.id ? { ...r, snoozeUntil } : r)))
}

// "Listo": it rang and you saw it (the snooze buttons go away).
export function dismissReminder(id: unknown): void {
  const current = reminders.find((r) => r.id === id)
  if (!current?.rangAt) return
  const seen: Reminder = { ...current }
  delete seen.rangAt
  commit(reminders.map((r) => (r.id === current.id ? seen : r)))
}
