import { BrowserWindow } from 'electron'
import type { NextActionState, TinyStepResult } from '../shared/types'
import { activeState, toISODate } from '../shared/nextAction'
import { getStatus, withFallback } from './ai'
import { dipBase } from './ai/dip'
import { loadSettings } from './storage'
import { readJson, writeJson } from './storage/jsonStore'
import { getTasks, updateTask } from './tasks'

// SPEC 9.5: what the user told Next Action today ("Saltar", "Tengo 30 min"). The main
// process keeps it, so the widget, its detached window and the menu bar all agree.
// Saved in next-action.json; it starts over every day.

const MAX_SKIPPED = 100
const AVAILABLE = [5, 10, 15, 30, 45, 60, 90, 120]

let state: NextActionState = { day: toISODate(new Date()), skipped: [], availableMin: null }
const listeners = new Set<(state: NextActionState) => void>()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function initNextAction(): Promise<void> {
  const data = await readJson<unknown>('next-action', null)
  if (!isObject(data) || typeof data.day !== 'string') return
  state = {
    day: data.day,
    skipped: Array.isArray(data.skipped)
      ? data.skipped.filter((id): id is string => typeof id === 'string')
      : [],
    availableMin: AVAILABLE.includes(data.availableMin as number)
      ? (data.availableMin as number)
      : null
  }
}

// Today's values (yesterday's skips no longer count).
export function getNextActionState(): NextActionState {
  return activeState(state, toISODate(new Date()))
}

export function onNextActionChange(listener: (state: NextActionState) => void): void {
  listeners.add(listener)
}

function commit(next: NextActionState): void {
  state = next
  writeJson('next-action', { version: 1, ...next }).catch((err) =>
    console.error('[next-action] could not save', err)
  )
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('nextAction:changed', next)
  listeners.forEach((listener) => listener(next))
}

export function setAvailable(minutes: unknown): void {
  const availableMin = AVAILABLE.includes(minutes as number) ? (minutes as number) : null
  commit({ ...getNextActionState(), availableMin })
}

export function skipAction(taskId: unknown): void {
  if (typeof taskId !== 'string' || !getTasks().some((t) => t.id === taskId)) return
  const current = getNextActionState()
  const skipped = [...current.skipped.filter((id) => id !== taskId), taskId]
  commit({ ...current, skipped: skipped.slice(-MAX_SKIPPED) })
}

// "Empezar": the big task becomes "En curso" (its next tender is the step being done).
// It also comes back from the end of the line if it had been skipped.
export function startAction(taskId: unknown): void {
  const task = getTasks().find((t) => t.id === taskId)
  if (!task || task.status === 'done') return
  const root = task.parentId ? getTasks().find((t) => t.id === task.parentId) : task
  if (root && root.status !== 'doing') updateTask(root.id, { status: 'doing' })
  const current = getNextActionState()
  if (current.skipped.includes(task.id)) {
    commit({ ...current, skipped: current.skipped.filter((id) => id !== task.id) })
  }
}

// --- "Solo empieza": the step as something that takes 2 minutes ---

function simpleTinyStep(title: string): string {
  return `Pon un temporizador de 2 minutos y solo prepara lo que necesitas para «${title}». Si quieres seguir después, genial; si no, también cuenta.`
}

export async function tinyStep(taskId: unknown): Promise<TinyStepResult> {
  const task = getTasks().find((t) => t.id === taskId)
  if (!task) return { ok: true, text: 'Elige algo chiquito y hazlo solo 2 minutos.', byAI: false }
  const settings = await loadSettings()
  // The task's name only goes to the AI with the user's permission.
  if (!settings.ai.shareTasksWithAI || !getStatus().active) {
    return { ok: true, text: simpleTinyStep(task.title), byAI: false }
  }
  const parent = task.parentId ? getTasks().find((t) => t.id === task.parentId) : undefined
  const instructions = dipBase(settings.dipPersonality, [
    `A la persona le cuesta empezar. Convierte el paso en una versión que tome solo 2 minutos: la primera acción física y concreta (abrir, sacar, escribir una frase...).
Responde con UNA sola frase corta (máximo 25 palabras), sin listas ni comillas, empezando con un verbo.`
  ])
  const request = parent
    ? `Paso: "${task.title}" (de la tarea "${parent.title}")`
    : `Tarea: "${task.title}"`
  try {
    const { value } = await withFallback(settings, (provider) =>
      provider.chat([
        { role: 'system', content: instructions },
        { role: 'user', content: request }
      ])
    )
    const text = value
      .trim()
      .replace(/^["«]|["»]$/g, '')
      .slice(0, 300)
    if (text) return { ok: true, text, byAI: true }
  } catch (err) {
    console.warn('[next-action] tiny step without AI', err)
  }
  return { ok: true, text: simpleTinyStep(task.title), byAI: false }
}
