import { BrowserWindow, dialog, shell } from 'electron'
import { promises as fs } from 'fs'
import { calendarEntries } from '../../shared/calendar'
import type { CalendarEvent, CalendarStatus, Settings } from '../../shared/types'
import { getDailies, onDailiesChange } from '../dailies'
import { changeSettings } from '../settings'
import { readJson, writeJson } from '../storage/jsonStore'
import { loadSettings } from '../storage'
import { getTasks, onTasksChange, updateTask } from '../tasks'
import {
  CalendarAccessError,
  listCalendars,
  readEvents,
  syncNuggitCalendar,
  type WrittenEntry
} from './apple'
import { currentIcs, feedUrl, startFeed, stopFeed } from './feed'
import { t } from '../../shared/i18n'

// SPEC 9.14: Nuggit's calendar and the ways it connects to others, each optional:
// - Paso 1: a .ics file to import anywhere (Google, Apple…) and a feed the Mac's Calendar
//   subscribes to (read-only there, updates itself).
// - Paso 2: two ways with the Mac's Calendar: its events show in Nuggit, and Nuggit keeps
//   a "Nuggit" calendar there with the tasks and dailies. Moving a task's event to another
//   day in Calendar moves the task in Nuggit too. Nothing else there is ever changed.
// - Paso 3 (Google Calendar with its API and a Google login) is not done yet.

const SYNC_EVERY_MS = 10 * 60_000
const CHANGE_DELAY_MS = 4000 // after editing tasks, wait a bit so several edits sync once
const EVENTS_TTL_MS = 2 * 60_000

let status: CalendarStatus = {
  feedUrl: null,
  apple: 'off',
  lastSync: null,
  error: null,
  moved: 0
}
let written: Record<string, WrittenEntry> = {}
let syncing: Promise<void> | null = null
let again = false
let changeTimer: ReturnType<typeof setTimeout> | null = null
const eventsCache = new Map<string, { at: number; events: CalendarEvent[] }>()

function setStatus(patch: Partial<CalendarStatus>): void {
  status = { ...status, ...patch }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('calendar:status', status)
}

function changed(): void {
  eventsCache.clear()
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('calendar:changed')
}

function accessError(err: unknown): Partial<CalendarStatus> {
  if (err instanceof CalendarAccessError) {
    return {
      apple: 'denied',
      error: t(
        'macOS no deja que Nuggit use Calendario. Actívalo en Ajustes del Sistema → Privacidad y seguridad → Automatización.',
        "macOS won't let Nuggit use Calendar. Turn it on in System Settings → Privacy & Security → Automation."
      )
    }
  }
  console.error('[calendar]', err)
  return {
    apple: 'error',
    error: t(
      'No pude hablar con Calendario. Intenta otra vez.',
      "I couldn't talk to Calendar. Try again."
    )
  }
}

export function getCalendarStatus(): CalendarStatus {
  return status
}

// --- Paso 1: .ics ---

export async function exportIcs(): Promise<{ ok: boolean; path?: string }> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: t('Exportar calendario de Nuggit', 'Export Nuggit calendar'),
    defaultPath: 'Nuggit.ics',
    filters: [{ name: t('Calendario', 'Calendar'), extensions: ['ics'] }]
  })
  if (canceled || !filePath) return { ok: false }
  await fs.writeFile(filePath, currentIcs(), 'utf8')
  return { ok: true, path: filePath }
}

async function applyFeed(settings: Settings): Promise<void> {
  if (settings.calendar.feed) {
    const ok = await startFeed()
    setStatus({ feedUrl: ok ? feedUrl() : null })
  } else {
    stopFeed()
    setStatus({ feedUrl: null })
  }
}

// Turns the feed on and lets the Calendar app offer to subscribe to it.
export async function subscribe(): Promise<void> {
  await changeSettings({ calendar: { feed: true } })
  await applyFeed(await loadSettings())
  if (status.feedUrl) await shell.openExternal(status.feedUrl)
}

// --- Paso 2: the Mac's Calendar ---

export async function listAppleCalendars(): Promise<
  { ok: true; calendars: string[] } | { ok: false; error: string }
> {
  try {
    const calendars = await listCalendars()
    if (status.apple === 'denied' || status.apple === 'error')
      setStatus({ apple: 'ok', error: null })
    return { ok: true, calendars }
  } catch (err) {
    const problem = accessError(err)
    setStatus(problem)
    return { ok: false, error: problem.error! }
  }
}

const dateAt = (day: string, end = false): Date => {
  const [y, m, d] = day.split('-').map(Number)
  return end ? new Date(y, m - 1, d + 1) : new Date(y, m - 1, d)
}

export async function getEvents(from: unknown, to: unknown): Promise<CalendarEvent[]> {
  const DAY = /^\d{4}-\d{2}-\d{2}$/
  if (typeof from !== 'string' || typeof to !== 'string' || !DAY.test(from) || !DAY.test(to)) {
    return []
  }
  const settings = await loadSettings()
  const names = settings.calendar.showCalendars.filter((n) => n !== 'Nuggit')
  if (!settings.calendar.apple || !names.length) return []
  const key = `${from}|${to}|${names.join(',')}`
  const cached = eventsCache.get(key)
  if (cached && Date.now() - cached.at < EVENTS_TTL_MS) return cached.events
  try {
    const events = await readEvents(names, dateAt(from), dateAt(to, true))
    eventsCache.set(key, { at: Date.now(), events })
    return events
  } catch (err) {
    setStatus(accessError(err))
    return []
  }
}

async function syncOnce(): Promise<void> {
  const settings = await loadSettings()
  if (!settings.calendar.apple || !settings.calendar.writeToApple) return
  setStatus({ apple: 'syncing', error: null })
  try {
    const entries = calendarEntries(getTasks(), getDailies())
    const result = await syncNuggitCalendar(entries, written)
    // Moved in Calendar: the task follows (it is the person's own change).
    for (const { key, date } of result.moved) {
      const id = key.slice('task:'.length)
      if (getTasks().some((t) => t.id === id)) updateTask(id, { dueDate: date })
    }
    const moved = new Set(result.moved.map((m) => m.key))
    written = Object.fromEntries(
      entries
        .filter((e) => !moved.has(e.key))
        .map((e) => [e.key, { date: e.date, title: e.title, time: e.time, rrule: e.rrule }])
    )
    await writeJson('calendar-sync', { version: 1, written })
    setStatus({
      apple: 'ok',
      lastSync: new Date().toISOString(),
      moved: status.moved + result.moved.length
    })
    if (result.created || result.updated || result.removed || result.moved.length) changed()
  } catch (err) {
    setStatus(accessError(err))
  }
}

// One sync at a time; a request during one runs once more right after.
export function syncNow(): Promise<void> {
  if (syncing) {
    again = true
    return syncing
  }
  syncing = syncOnce().finally(() => {
    syncing = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return syncing
}

// Automatic mode only; in manual mode only "Sincronizar ahora" syncs.
async function syncIfAuto(): Promise<void> {
  if ((await loadSettings()).calendar.autoSync) await syncNow()
}

function syncSoon(): void {
  if (changeTimer) clearTimeout(changeTimer)
  changeTimer = setTimeout(() => void syncIfAuto(), CHANGE_DELAY_MS)
}

// Called when Ajustes change: the feed and the Mac's Calendar follow the new choice.
export async function applyCalendarSettings(settings: Settings): Promise<void> {
  await applyFeed(settings)
  eventsCache.clear()
  if (!settings.calendar.apple) {
    setStatus({ apple: 'off', error: null })
  } else if (status.apple === 'off') {
    setStatus({ apple: 'ok' })
    void syncIfAuto()
  }
  changed()
}

export async function initCalendar(): Promise<void> {
  const data = await readJson<{ written?: Record<string, WrittenEntry> }>('calendar-sync', {})
  written = data.written && typeof data.written === 'object' ? data.written : {}
  const settings = await loadSettings()
  await applyFeed(settings)
  if (settings.calendar.apple) {
    setStatus({ apple: 'ok' })
    void syncIfAuto()
  }
  onTasksChange(syncSoon)
  onDailiesChange(syncSoon)
  setInterval(() => {
    eventsCache.clear()
    void syncIfAuto()
  }, SYNC_EVERY_MS)
}
