import { BrowserWindow, Notification } from 'electron'
import type { FocusPreset, FocusState } from '../shared/types'
import { pickNextActions, toISODate } from '../shared/nextAction'
import { getNextActionState, startAction } from './nextAction'
import { readJson, writeJson } from './storage/jsonStore'
import { getTasks } from './tasks'
import { onBreakStart, onFocusPause, onFocusStart, onFocusStop } from './music'
import { t } from '../shared/i18n'

// SPEC 9.8. The Focus timer lives here, so the widget, its tab and a detached window all
// show the same one; it also keeps running (and survives a restart)
// while no window is open. A focus round is followed by its break, then it waits.

const MIN_MINUTES = 1
const MAX_MINUTES = 180
const DEFAULT_PRESET: FocusPreset = { focusMin: 25, breakMin: 5 }

let state: FocusState = {
  preset: DEFAULT_PRESET,
  phase: 'idle',
  endsAt: null,
  pausedLeftMs: null,
  durationMs: 0,
  taskId: null,
  rounds: 0,
  roundsDay: toISODate(new Date())
}
let timer: ReturnType<typeof setTimeout> | null = null

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const minutes = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)))
    : fallback

function cleanPreset(value: unknown): FocusPreset | null {
  if (!isObject(value)) return null
  return {
    focusMin: minutes(value.focusMin, DEFAULT_PRESET.focusMin),
    breakMin: minutes(value.breakMin, DEFAULT_PRESET.breakMin)
  }
}

const phaseMs = (phase: 'focus' | 'break', preset: FocusPreset): number =>
  (phase === 'focus' ? preset.focusMin : preset.breakMin) * 60_000

// Time left in the current phase (running or paused).
function leftMs(now = Date.now()): number {
  if (state.pausedLeftMs !== null) return state.pausedLeftMs
  return state.endsAt ? Math.max(0, Date.parse(state.endsAt) - now) : 0
}

function commit(next: FocusState): void {
  state = next
  writeJson('focus', { version: 1, ...next }).catch((err) =>
    console.error('[focus] could not save', err)
  )
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('focus:changed', next)
  schedule()
}

// Wakes up when the running phase ends.
function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (state.phase === 'idle' || !state.endsAt || state.pausedLeftMs !== null) return
  // setTimeout can't wait longer than ~24 days; phases are at most 3 h anyway.
  timer = setTimeout(finishPhase, Math.max(0, Date.parse(state.endsAt) - Date.now()) + 50)
}

// One gentle notice per phase, never more (SPEC: no notification spam).
function notify(body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title: 'Nuggit', body, silent: false }).show()
}

function finishPhase(): void {
  if (state.phase === 'focus') {
    const today = toISODate(new Date())
    const rounds = (state.roundsDay === today ? state.rounds : 0) + 1
    const durationMs = phaseMs('break', state.preset)
    notify(
      t(
        `¡Ronda lista! 🎉 Descansa ${state.preset.breakMin} min.`,
        `Round done! 🎉 Take a ${state.preset.breakMin} min break.`
      )
    )
    void onBreakStart()
    commit({
      ...state,
      phase: 'break',
      durationMs,
      endsAt: new Date(Date.now() + durationMs).toISOString(),
      pausedLeftMs: null,
      rounds,
      roundsDay: today
    })
  } else if (state.phase === 'break') {
    notify(t('Se acabó el descanso. ¿Otra ronda? 💪', 'Break is over. Another round? 💪'))
    void onFocusStop()
    commit({ ...state, phase: 'idle', endsAt: null, pausedLeftMs: null, durationMs: 0 })
  }
}

export async function initFocus(): Promise<void> {
  const data = await readJson<unknown>('focus', null)
  if (isObject(data)) {
    const phase = data.phase === 'focus' || data.phase === 'break' ? data.phase : 'idle'
    const running = phase !== 'idle'
    state = {
      preset: cleanPreset(data.preset) ?? DEFAULT_PRESET,
      phase,
      endsAt: running && typeof data.endsAt === 'string' ? data.endsAt : null,
      pausedLeftMs:
        running && typeof data.pausedLeftMs === 'number' ? Math.max(0, data.pausedLeftMs) : null,
      durationMs: running && typeof data.durationMs === 'number' ? data.durationMs : 0,
      taskId: typeof data.taskId === 'string' ? data.taskId : null,
      rounds: typeof data.rounds === 'number' ? data.rounds : 0,
      roundsDay: typeof data.roundsDay === 'string' ? data.roundsDay : state.roundsDay
    }
    if (running && !state.endsAt && state.pausedLeftMs === null) state.phase = 'idle'
  }
  // A phase that ended while Nuggit was closed just ends, quietly.
  if (state.phase !== 'idle' && state.pausedLeftMs === null && leftMs() === 0) {
    state = { ...state, phase: 'idle', endsAt: null, durationMs: 0 }
  }
  schedule()
}

export function getFocus(): FocusState {
  return state
}

// The task Focus is about: the chosen one if still pending, else Next Action's.
function focusTaskId(): string | null {
  const tasks = getTasks()
  const chosen = tasks.find((t) => t.id === state.taskId && t.status !== 'done')
  if (chosen) return chosen.id
  const [next] = pickNextActions(tasks, getNextActionState(), toISODate(new Date()), 1)
  return next?.task.id ?? null
}

export function startFocus(taskId: unknown): void {
  const chosen = typeof taskId === 'string' && getTasks().some((t) => t.id === taskId)
  const next = { ...state, taskId: chosen ? (taskId as string) : state.taskId }
  state = next
  // Working on it now: the task becomes "En curso", like "Empezar" in Next Action.
  const id = focusTaskId()
  if (id) startAction(id)
  const durationMs = phaseMs('focus', state.preset)
  void onFocusStart()
  commit({
    ...state,
    phase: 'focus',
    durationMs,
    endsAt: new Date(Date.now() + durationMs).toISOString(),
    pausedLeftMs: null
  })
}

export function pauseFocus(): void {
  if (state.phase === 'idle' || state.pausedLeftMs !== null) return
  commit({ ...state, pausedLeftMs: leftMs(), endsAt: null })
  void onFocusPause(true)
}

export function resumeFocus(): void {
  if (state.phase === 'idle' || state.pausedLeftMs === null) return
  commit({
    ...state,
    endsAt: new Date(Date.now() + state.pausedLeftMs).toISOString(),
    pausedLeftMs: null
  })
  void onFocusPause(false)
}

export function cancelFocus(): void {
  if (state.phase !== 'idle') void onFocusStop()
  commit({ ...state, phase: 'idle', endsAt: null, pausedLeftMs: null, durationMs: 0 })
}

// "Cambiar en cualquier momento": a running phase keeps the time already done and gets
// the new length (if that is already over, the phase ends now).
export function setFocusPreset(input: unknown): void {
  const preset = cleanPreset(input)
  if (!preset) return
  if (state.phase === 'idle') return commit({ ...state, preset })
  const durationMs = phaseMs(state.phase, preset)
  const done = state.durationMs - leftMs()
  const left = Math.max(0, durationMs - done)
  const paused = state.pausedLeftMs !== null
  commit({
    ...state,
    preset,
    durationMs,
    pausedLeftMs: paused ? left : null,
    endsAt: paused ? null : new Date(Date.now() + left).toISOString()
  })
}

export function setFocusTask(taskId: unknown): void {
  if (taskId === null) return commit({ ...state, taskId: null })
  if (typeof taskId !== 'string' || !getTasks().some((t) => t.id === taskId)) return
  commit({ ...state, taskId })
  if (state.phase === 'focus') startAction(taskId)
}
