import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type {
  AIChatResult,
  DipAction,
  DipChatMessage,
  DipChatState,
  DipTaskFields,
  Priority,
  TaskInput,
  TaskStatusChange
} from '../shared/types'
import { pickNextActions, toISODate } from '../shared/nextAction'
import { errorMessage } from './ai'
import { chatWithActions } from './ai/actions'
import { readJson, writeJson } from './storage/jsonStore'
import { getNextActionState } from './nextAction'
import { completeTask, createTask, getTasks, removeTask, setStatuses, updateTask } from './tasks'

// The conversation with Dip, shared by the Dip widget, its detached window, the Dip tab and
// the menu bar mini chat. Saved in dip-chat.json so the history survives restarts.
// Dip can propose one action per answer; it only happens when the user saves its card.
const MAX_SAVED = 200
const MAX_TEXT = 4000
const MAX_HISTORY = 30

// How to undo a saved action, by message id.
type Undo =
  | { kind: 'remove'; taskId: string }
  | { kind: 'restore'; taskId: string; previous: TaskInput }
  | { kind: 'statuses'; previous: TaskStatusChange[] }

let state: DipChatState = { messages: [], pending: false }
let undos: Record<string, Undo> = {}
let loaded = false

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMessage(value: unknown): value is DipChatMessage {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    typeof value.at === 'string'
  )
}

export async function initDipChat(): Promise<void> {
  const data = await readJson<unknown>('dip-chat', null)
  const messages =
    isObject(data) && Array.isArray(data.messages) ? data.messages.filter(isMessage) : []
  undos = isObject(data) && isObject(data.undos) ? (data.undos as Record<string, Undo>) : {}
  state = { messages, pending: false }
  loaded = true
}

export function getDipChat(): DipChatState {
  return state
}

function commit(next: DipChatState, save: boolean): void {
  state = next
  if (save && loaded) {
    const messages = next.messages.slice(-MAX_SAVED)
    const ids = new Set(messages.map((m) => m.id))
    undos = Object.fromEntries(Object.entries(undos).filter(([id]) => ids.has(id)))
    writeJson('dip-chat', { version: 1, messages, undos }).catch((err) =>
      console.error('[dip-chat] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('dipChat:changed', state)
}

function message(role: DipChatMessage['role'], content: string): DipChatMessage {
  return { id: randomUUID(), role, content, at: new Date().toISOString() }
}

function describe(action: DipAction): string {
  if (action.type === 'create') return `anotar "${action.title}"`
  if (action.type === 'complete') return `marcar como hecha "${action.taskTitle}"`
  return `cambiar "${action.taskTitle}"`
}

const STATE_NOTES = {
  pending: 'sin confirmar',
  saved: 'la persona la guardó',
  cancelled: 'la persona la canceló',
  undone: 'la persona la deshizo'
}

// What Dip sees of the history: the text, plus what happened to each proposed action.
function history(): Array<{ role: 'user' | 'assistant'; content: string }> {
  return state.messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content:
      m.action && m.actionState
        ? `${m.content}\n(Acción propuesta: ${describe(m.action)}; ${STATE_NOTES[m.actionState]}.)`
        : m.content
  }))
}

// Asks Dip about the current history (which must end with the user's message).
async function answer(voice = false): Promise<AIChatResult> {
  commit({ ...state, pending: true }, false)
  try {
    const result = await chatWithActions(history(), { voice })
    const reply: DipChatMessage = {
      ...message('assistant', result.text),
      ...(result.action ? { action: result.action, actionState: 'pending' as const } : {})
    }
    commit({ messages: [...state.messages, reply], pending: false }, true)
    return { ok: true, text: result.text, backend: result.backend }
  } catch (err) {
    commit({ ...state, pending: false }, false)
    return { ok: false, error: errorMessage(err) }
  }
}

export async function sendToDip(input: unknown, options?: unknown): Promise<AIChatResult> {
  const text = typeof input === 'string' ? input.trim().slice(0, MAX_TEXT) : ''
  if (!text) return { ok: false, error: 'Escribe algo para Dip.' }
  if (state.pending) return { ok: false, error: 'Dip todavía está contestando.' }
  commit({ ...state, messages: [...state.messages, message('user', text)] }, true)
  const voice = isObject(options) && options.voice === true
  return answer(voice)
}

// Tries again after an error (the last message is the user's, still unanswered).
export async function retryDip(): Promise<AIChatResult> {
  const last = state.messages[state.messages.length - 1]
  if (state.pending || last?.role !== 'user') {
    return { ok: false, error: 'No hay nada que reintentar.' }
  }
  return answer()
}

export function clearDipChat(): void {
  if (state.pending) return
  undos = {}
  commit({ messages: [], pending: false }, true)
}

// --- Action cards ---

const DATE = /^\d{4}-\d{2}-\d{2}$/
const PRIORITIES = ['low', 'medium', 'high']

// Only valid edits from the interface; '' clears the date.
function cleanEdits(input: unknown): DipTaskFields & { taskId?: string } {
  if (!isObject(input)) return {}
  const edits: DipTaskFields & { taskId?: string } = {}
  if (typeof input.title === 'string' && input.title.trim())
    edits.title = input.title.trim().slice(0, 200)
  if (typeof input.dueDate === 'string' && (DATE.test(input.dueDate) || input.dueDate === '')) {
    edits.dueDate = input.dueDate
  }
  if (PRIORITIES.includes(input.priority as string)) edits.priority = input.priority as Priority
  if (typeof input.taskId === 'string') edits.taskId = input.taskId
  return edits
}

function setMessage(id: string, patch: Partial<DipChatMessage>): void {
  commit(
    { ...state, messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) },
    true
  )
}

export function applyAction(messageId: unknown, input: unknown): { ok: boolean; error?: string } {
  const msg = state.messages.find((m) => m.id === messageId)
  if (!msg?.action || msg.actionState !== 'pending')
    return { ok: false, error: 'Esa propuesta ya no está.' }
  const edits = cleanEdits(input)
  const action = msg.action
  try {
    if (action.type === 'create') {
      const fields = {
        title: edits.title ?? action.title,
        dueDate: edits.dueDate ?? action.dueDate,
        priority: edits.priority ?? action.priority
      }
      const task = createTask({ ...fields, dueDate: fields.dueDate || null })
      undos[msg.id] = { kind: 'remove', taskId: task.id }
      setMessage(msg.id, {
        action: { type: 'create', ...fields, title: task.title },
        actionState: 'saved'
      })
      return { ok: true }
    }

    const task = getTasks().find((t) => t.id === (edits.taskId ?? action.taskId))
    if (!task) return { ok: false, error: 'Esa tarea ya no existe.' }

    if (action.type === 'complete') {
      // The same "Hecho" as Next Action: the last tender also finishes its big task.
      undos[msg.id] = { kind: 'statuses', previous: completeTask(task.id) }
      setMessage(msg.id, {
        action: { type: 'complete', taskId: task.id, taskTitle: task.title },
        actionState: 'saved'
      })
      suggestNext()
      return { ok: true }
    }

    const changes: DipTaskFields = { ...action.changes }
    if (edits.title) changes.title = edits.title
    if (edits.dueDate !== undefined) changes.dueDate = edits.dueDate
    if (edits.priority) changes.priority = edits.priority
    undos[msg.id] = {
      kind: 'restore',
      taskId: task.id,
      previous: { title: task.title, dueDate: task.dueDate ?? null, priority: task.priority }
    }
    updateTask(task.id, { ...changes, ...(changes.dueDate === '' ? { dueDate: null } : {}) })
    setMessage(msg.id, {
      action: { type: 'update', taskId: task.id, taskTitle: task.title, changes },
      actionState: 'saved'
    })
    return { ok: true }
  } catch (err) {
    console.error('[dip-chat] could not apply action', err)
    return { ok: false, error: 'No pude guardarlo. Intenta otra vez.' }
  }
}

// After "ya terminé X" is saved, Dip says what comes next (the Next Action rules, no AI).
function suggestNext(): void {
  const next = pickNextActions(getTasks(), getNextActionState(), toISODate(new Date()), 1)[0]
  let text = '¡Bien hecho! 🎉 No te queda nada pendiente. A descansar un ratito ✨'
  if (next) {
    const minutes = next.minutes ? ` (unos ${next.minutes} min)` : ''
    text =
      next.task === next.root
        ? `¡Bien hecho! 🎉 Lo siguiente: «${next.task.title}»${minutes}.`
        : `¡Bien hecho! 🎉 Siguiente paso de «${next.root.title}»: «${next.task.title}»${minutes}.`
  }
  commit({ ...state, messages: [...state.messages, message('assistant', text)] }, true)
}

export function cancelAction(messageId: unknown): void {
  const msg = state.messages.find((m) => m.id === messageId)
  if (msg?.action && msg.actionState === 'pending') setMessage(msg.id, { actionState: 'cancelled' })
}

export function undoAction(messageId: unknown): void {
  const msg = state.messages.find((m) => m.id === messageId)
  const undo = msg ? undos[msg.id] : undefined
  if (!msg || msg.actionState !== 'saved' || !undo) return
  if (undo.kind === 'remove') removeTask(undo.taskId)
  else if (undo.kind === 'statuses') setStatuses(undo.previous)
  else updateTask(undo.taskId, undo.previous)
  delete undos[msg.id]
  setMessage(msg.id, { actionState: 'undone' })
}
