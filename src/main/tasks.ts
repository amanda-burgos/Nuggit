import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { Task, TaskInput, TaskStatusChange } from '../shared/types'
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

// A big task and its tenders, saved in one go (so one undo removes them all).
export function createTaskWithSteps(input: unknown): Task[] {
  if (!isObject(input) || !cleanText(input.title, MAX_TITLE)) throw new Error('Task needs a title')
  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .filter(
      (s): s is Record<string, unknown> => isObject(s) && Boolean(cleanText(s.title, MAX_TITLE))
    )
    .slice(0, 30)
  const now = new Date().toISOString()
  const base = { priority: 'medium', status: 'todo', createdAt: now, updatedAt: now } as const
  const topOrder = tasks.filter((t) => !t.parentId).reduce((max, t) => Math.max(max, t.order), -1)

  const parent = applyInput(
    { ...base, id: randomUUID(), title: '', order: topOrder + 1 },
    {
      title: input.title,
      dueDate: input.dueDate,
      estimateMin: steps.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0) || undefined
    }
  )
  const children = steps.map((step, order) =>
    applyInput(
      { ...base, id: randomUUID(), title: '', order, parentId: parent.id },
      {
        title: step.title,
        estimateMin: step.minutes
      }
    )
  )
  commit([...tasks, parent, ...children])
  return [parent, ...children]
}

export function updateTask(id: string, patch: unknown): void {
  const current = tasks.find((t) => t.id === id)
  if (!current) return
  const next = applyInput(current, patch)
  next.updatedAt = new Date().toISOString()
  commit(tasks.map((t) => (t.id === id ? next : t)))
}

// "✅ Hecho" on a task or tender. Finishing the last pending tender finishes its big task
// too. Returns the previous statuses, for "Deshacer".
export function completeTask(id: string): TaskStatusChange[] {
  const task = tasks.find((t) => t.id === id)
  if (!task || task.status === 'done') return []
  const changes: TaskStatusChange[] = [{ id: task.id, status: task.status }]
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : undefined
  const othersLeft = tasks.some(
    (t) => t.parentId === task.parentId && t.id !== task.id && t.status !== 'done'
  )
  if (parent && parent.status !== 'done' && !othersLeft) {
    changes.push({ id: parent.id, status: parent.status })
  }
  setStatuses(changes.map((c) => ({ id: c.id, status: 'done' })))
  return changes
}

// Sets several statuses in one save (used by "Hecho" and its undo).
export function setStatuses(input: unknown): void {
  if (!Array.isArray(input)) return
  const now = new Date().toISOString()
  const byId = new Map<string, unknown>()
  for (const c of input) if (isObject(c) && typeof c.id === 'string') byId.set(c.id, c.status)
  let changed = false
  const next = tasks.map((t) => {
    if (!byId.has(t.id)) return t
    const updated = applyInput(t, { status: byId.get(t.id) })
    if (updated === t || updated.status === t.status) return t
    changed = true
    return { ...updated, updatedAt: now }
  })
  if (changed) commit(next)
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

// --- Dailies (SPEC 9.13): each due daily is a real task for today ---

export interface DailyTaskPlan {
  today: string
  due: Map<string, { title: string; estimateMin?: number }> // dailies due today, by id
  make: Set<string> // due dailies whose task for today should be made now
  known: Set<string> // every daily that exists
}

// Makes today's tasks for the dailies, in one save. Copies from earlier days go away (done
// ones are already in the daily's history; pending ones are not left behind as overdue,
// no guilt). So does a pending copy of a daily that is no longer due today or was deleted.
export function syncDailyTasks(plan: DailyTaskPlan): void {
  if (!loaded) return
  const now = new Date().toISOString()
  const remove = new Set<string>()
  const existing = new Set<string>()
  let changed = false

  const next = tasks.map((t) => {
    if (!t.dailyId) return t
    const due = plan.due.get(t.dailyId)
    const old = !t.dueDate || t.dueDate < plan.today
    const unwanted = !plan.known.has(t.dailyId) || (!due && t.status !== 'done')
    if (old || unwanted) {
      remove.add(t.id)
      return t
    }
    existing.add(t.dailyId)
    // A renamed daily, or a new estimate: today's pending copy follows.
    if (
      due &&
      t.status !== 'done' &&
      (t.title !== due.title || t.estimateMin !== due.estimateMin)
    ) {
      changed = true
      return applyInput(
        { ...t, updatedAt: now },
        { title: due.title, estimateMin: due.estimateMin ?? null }
      )
    }
    return t
  })

  // Tenders someone added to a copy go with it.
  for (const t of next) if (t.parentId && remove.has(t.parentId)) remove.add(t.id)

  const topOrder = next.filter((t) => !t.parentId).reduce((max, t) => Math.max(max, t.order), -1)
  const made: Task[] = []
  for (const id of plan.make) {
    const due = plan.due.get(id)
    if (!due || existing.has(id)) continue
    made.push(
      applyInput(
        {
          id: randomUUID(),
          title: '',
          priority: 'medium',
          status: 'todo',
          order: topOrder + 1 + made.length,
          dailyId: id,
          createdAt: now,
          updatedAt: now
        },
        { title: due.title, dueDate: plan.today, estimateMin: due.estimateMin }
      )
    )
  }

  if (!changed && remove.size === 0 && made.length === 0) return
  commit([...next.filter((t) => !remove.has(t.id)), ...made])
}
