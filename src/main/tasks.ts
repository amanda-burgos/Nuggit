import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { Task, TaskInput } from '../shared/types'
import { isTask, loadTasks, saveTasks } from './storage'

// Like the desktop, the main process holds the one true list of tasks, because the board
// and any detached widget window can show and change them. Every change is saved and sent
// to every window.
let tasks: Task[] = []
// If tasks.json could not be read, never save over it with an empty list.
let loaded = false
const listeners = new Set<(tasks: Task[]) => void>()

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TITLE = 500
const MAX_TEXT = 10000
const MAX_ESTIMATE = 7 * 24 * 60

export async function initTasks(): Promise<void> {
  tasks = await loadTasks()
  loaded = true
}

export function getTasks(): Task[] {
  return tasks
}

export function onTasksChange(listener: (tasks: Task[]) => void): void {
  listeners.add(listener)
}

function commit(next: Task[]): void {
  if (!loaded) throw new Error('Tasks were not loaded, refusing to overwrite tasks.json')
  tasks = next
  saveTasks(next).catch((err) => console.error('[tasks] could not save', err))
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('tasks:changed', next)
  listeners.forEach((listener) => listener(next))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanText(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.trim().slice(0, max) || undefined : undefined
}

const isCleared = (value: unknown): boolean => value === null || value === ''

// Applies only the valid fields of an untrusted patch. null or '' clears an optional
// field; any other invalid value is ignored.
function applyInput(task: Task, input: unknown): Task {
  if (!isObject(input)) return task
  const next: Task = { ...task }
  const patch = input as TaskInput

  const title = cleanText(patch.title, MAX_TITLE)
  if (title) next.title = title

  for (const key of ['description', 'category', 'notes'] as const) {
    if (!(key in patch)) continue
    const text = cleanText(patch[key], key === 'category' ? 100 : MAX_TEXT)
    if (text) next[key] = text
    else delete next[key]
  }

  if (typeof patch.dueDate === 'string' && DATE.test(patch.dueDate)) next.dueDate = patch.dueDate
  else if (isCleared(patch.dueDate)) delete next.dueDate

  const min = patch.estimateMin
  if (typeof min === 'number' && Number.isFinite(min) && min > 0) {
    next.estimateMin = Math.min(Math.round(min), MAX_ESTIMATE)
  } else if (isCleared(min)) delete next.estimateMin

  if (patch.priority && ['low', 'medium', 'high'].includes(patch.priority)) {
    next.priority = patch.priority
  }

  if (patch.status && ['todo', 'doing', 'done'].includes(patch.status)) {
    if (patch.status === 'done' && next.status !== 'done') {
      next.completedAt = new Date().toISOString()
    }
    if (patch.status !== 'done') delete next.completedAt
    next.status = patch.status
  }

  return next
}

export function createTask(input: unknown): Task {
  if (!isObject(input) || !cleanText(input.title, MAX_TITLE)) throw new Error('Task needs a title')
  let parentId: string | undefined
  if (typeof input.parentId === 'string') {
    const parent = tasks.find((t) => t.id === input.parentId)
    // Tenders are one level deep: a step of a step goes to the same big task.
    if (!parent) throw new Error('Parent task not found')
    parentId = parent.parentId ?? parent.id
  }

  const siblings = tasks.filter((t) => t.parentId === parentId)
  const now = new Date().toISOString()
  const base: Task = {
    id: randomUUID(),
    title: '',
    priority: 'medium',
    status: 'todo',
    order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
    createdAt: now,
    updatedAt: now,
    ...(parentId ? { parentId } : {})
  }
  const task = applyInput(base, input)
  commit([...tasks, task])
  return task
}

export function updateTask(id: string, patch: unknown): void {
  const current = tasks.find((t) => t.id === id)
  if (!current) return
  const next = applyInput(current, patch)
  next.updatedAt = new Date().toISOString()
  commit(tasks.map((t) => (t.id === id ? next : t)))
}

// Removes a task and all its subtasks, and returns them so they can be restored.
export function removeTask(id: string): Task[] {
  const doomed = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const t of tasks) {
      if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
        doomed.add(t.id)
        grew = true
      }
    }
  }
  const removed = tasks.filter((t) => doomed.has(t.id))
  if (removed.length) commit(tasks.filter((t) => !doomed.has(t.id)))
  return removed
}

export function restoreTasks(input: unknown): void {
  if (!Array.isArray(input)) return
  const ids = new Set(tasks.map((t) => t.id))
  const incoming = input.filter((t): t is Task => isTask(t) && !ids.has(t.id))
  const known = new Set([...ids, ...incoming.map((t) => t.id)])
  const valid = incoming.filter((t) => !t.parentId || known.has(t.parentId))
  if (valid.length) commit([...tasks, ...valid])
}
