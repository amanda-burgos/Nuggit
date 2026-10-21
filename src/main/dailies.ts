import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { Daily, DailyRepeat, Task } from '../shared/types'
import { isDueOn } from '../shared/dailies'
import { toISODate } from '../shared/nextAction'
import { readJson, writeJson } from './storage/jsonStore'
import { onTasksChange, syncDailyTasks } from './tasks'

// SPEC 9.13: dailies, things that repeat on a schedule. The main process keeps them (in
// dailies.json) and makes each due one a real task for today, so they show up in Tareas,
// in Next Action, in the menu bar and in Dip's context like any other task. Ticking that
// task off is what marks the daily as done for the day.

const MAX_DAILIES = 100
const MAX_HISTORY = 400 // days of "done" kept, for the streak
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

let dailies: Daily[] = []
const listeners = new Set<(dailies: Daily[]) => void>()
let loaded = false
let today = toISODate(new Date())

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanRepeat(value: unknown): DailyRepeat | null {
  if (!isObject(value)) return null
  if (value.kind === 'every-day') return { kind: 'every-day' }
  if (value.kind === 'weekdays' && Array.isArray(value.days)) {
    const days = [...new Set(value.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (days.length === 7) return { kind: 'every-day' }
    return days.length ? { kind: 'weekdays', days: days.sort() } : null
  }
  if (value.kind === 'every-n' && Number.isInteger(value.n)) {
    const n = Math.min(Math.max(value.n as number, 1), 365)
    if (n === 1) return { kind: 'every-day' }
    const start = typeof value.start === 'string' && DATE.test(value.start) ? value.start : today
    return { kind: 'every-n', n, start }
  }
  return null
}

function isDaily(value: unknown): value is Daily {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    cleanRepeat(value.repeat) !== null &&
    typeof value.streak === 'boolean' &&
    Array.isArray(value.done) &&
    Number.isFinite(value.order)
  )
}

// Only the valid fields of an untrusted patch. null clears the time or the estimate.
function applyInput(daily: Daily, input: unknown): Daily {
  if (!isObject(input)) return daily
  const next = { ...daily }
  if (typeof input.title === 'string' && input.title.trim()) {
    next.title = input.title.trim().slice(0, 200)
  }
  const repeat = input.repeat === undefined ? null : cleanRepeat(input.repeat)
  if (repeat) next.repeat = repeat
  if (typeof input.time === 'string' && TIME.test(input.time)) next.time = input.time
  else if (input.time === null || input.time === '') delete next.time
  const min = input.estimateMin
  if (typeof min === 'number' && Number.isFinite(min) && min > 0) {
    next.estimateMin = Math.min(Math.round(min), 24 * 60)
  } else if (min === null) delete next.estimateMin
  if (typeof input.streak === 'boolean') next.streak = input.streak
  return next
}

// --- Today's tasks ---

function syncToday(): void {
  const due = new Map<string, { title: string; estimateMin?: number }>()
  const make = new Set<string>()
  for (const d of dailies) {
    if (!isDueOn(d.repeat, today)) continue
    due.set(d.id, { title: d.title, ...(d.estimateMin ? { estimateMin: d.estimateMin } : {}) })
    if (d.lastMade !== today) make.add(d.id)
  }
  syncDailyTasks({ today, due, make, known: new Set(dailies.map((d) => d.id)) })
  // Remember they were made today, so one deleted by hand doesn't come back until next time.
  if (make.size) {
    commit(dailies.map((d) => (make.has(d.id) ? { ...d, lastMade: today } : d)))
  }
}

// Ticking (or unticking) a daily's task records it in the daily's history, for the streak.
function recordDone(tasks: Task[]): void {
  const byDaily = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.dailyId && t.dueDate) byDaily.set(t.dailyId, [...(byDaily.get(t.dailyId) ?? []), t])
  }
  let changed = false
  const next = dailies.map((d) => {
    let done = d.done
    for (const t of byDaily.get(d.id) ?? []) {
      const has = done.includes(t.dueDate!)
      if (t.status === 'done' && !has) done = [...done, t.dueDate!].sort().slice(-MAX_HISTORY)
      else if (t.status !== 'done' && has) done = done.filter((day) => day !== t.dueDate)
    }
    if (done === d.done) return d
    changed = true
    return { ...d, done }
  })
  if (changed) commit(next)
}

// --- Saving ---

function commit(next: Daily[]): void {
  dailies = next
  if (loaded) {
    writeJson('dailies', { version: 1, dailies: next }).catch((err) =>
      console.error('[dailies] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('dailies:changed', next)
  listeners.forEach((listener) => listener(next))
}

export function onDailiesChange(listener: (dailies: Daily[]) => void): void {
  listeners.add(listener)
}

// Changes made by the user also update today's tasks.
function change(next: Daily[]): void {
  commit(next)
  syncToday()
}

export async function initDailies(): Promise<void> {
  const data = await readJson<unknown>('dailies', null)
  dailies = isObject(data) && Array.isArray(data.dailies) ? data.dailies.filter(isDaily) : []
  loaded = true
  onTasksChange(recordDone)
  syncToday()
  // A new day: yesterday's copies go, today's are made.
  setInterval(() => {
    const now = toISODate(new Date())
    if (now === today) return
    today = now
    syncToday()
  }, 60_000)
}

export function getDailies(): Daily[] {
  return dailies
}

function makeDaily(input: unknown, order: number): Daily | null {
  if (!isObject(input) || typeof input.title !== 'string' || !input.title.trim()) return null
  if (!cleanRepeat(input.repeat)) return null
  const now = new Date().toISOString()
  return applyInput(
    {
      id: randomUUID(),
      title: '',
      repeat: { kind: 'every-day' },
      streak: true,
      done: [],
      order,
      createdAt: now,
      updatedAt: now
    },
    input
  )
}

export function createDailies(inputs: unknown): Daily[] {
  if (!Array.isArray(inputs)) return []
  const top = dailies.reduce((max, d) => Math.max(max, d.order), -1)
  const made = inputs
    .slice(0, Math.max(0, MAX_DAILIES - dailies.length))
    .map((input, i) => makeDaily(input, top + 1 + i))
    .filter((d): d is Daily => d !== null)
  if (made.length) change([...dailies, ...made])
  return made
}

export function createDaily(input: unknown): Daily {
  const [daily] = createDailies([input])
  if (!daily) throw new Error('A daily needs a title and a valid repeat')
  return daily
}

export function updateDaily(id: unknown, patch: unknown): void {
  const current = dailies.find((d) => d.id === id)
  if (!current) return
  const next = { ...applyInput(current, patch), updatedAt: new Date().toISOString() }
  change(dailies.map((d) => (d.id === current.id ? next : d)))
}

export function removeDailies(ids: unknown): void {
  if (!Array.isArray(ids)) return
  const doomed = new Set(ids.filter((id): id is string => typeof id === 'string'))
  if (dailies.some((d) => doomed.has(d.id))) change(dailies.filter((d) => !doomed.has(d.id)))
}
