import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { AIChatResult, DipChatMessage, DipChatState } from '../shared/types'
import { chat } from './ai'
import { readJson, writeJson } from './storage/jsonStore'

// The conversation with Dip, shared by the Dip widget, its detached window and the Dip tab.
// Saved in dip-chat.json so the history survives restarts.
const MAX_SAVED = 200
const MAX_TEXT = 4000

let state: DipChatState = { messages: [], pending: false }
let loaded = false

function isMessage(value: unknown): value is DipChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string' &&
    typeof m.at === 'string'
  )
}

export async function initDipChat(): Promise<void> {
  const data = await readJson<unknown>('dip-chat', null)
  const messages =
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { messages?: unknown }).messages)
      ? (data as { messages: unknown[] }).messages.filter(isMessage)
      : []
  state = { messages, pending: false }
  loaded = true
}

export function getDipChat(): DipChatState {
  return state
}

function commit(next: DipChatState, save: boolean): void {
  state = next
  if (save && loaded) {
    writeJson('dip-chat', { version: 1, messages: next.messages.slice(-MAX_SAVED) }).catch((err) =>
      console.error('[dip-chat] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('dipChat:changed', state)
}

function message(role: DipChatMessage['role'], content: string): DipChatMessage {
  return { id: randomUUID(), role, content, at: new Date().toISOString() }
}

// Asks Dip about the current history (which must end with the user's message).
async function answer(): Promise<AIChatResult> {
  commit({ ...state, pending: true }, false)
  const result = await chat(state.messages.map(({ role, content }) => ({ role, content })))
  const messages = result.ok
    ? [...state.messages, message('assistant', result.text)]
    : state.messages
  commit({ messages, pending: false }, result.ok)
  return result
}

export async function sendToDip(input: unknown): Promise<AIChatResult> {
  const text = typeof input === 'string' ? input.trim().slice(0, MAX_TEXT) : ''
  if (!text) return { ok: false, error: 'Escribe algo para Dip.' }
  if (state.pending) return { ok: false, error: 'Dip todavía está contestando.' }
  commit({ ...state, messages: [...state.messages, message('user', text)] }, true)
  return answer()
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
  commit({ messages: [], pending: false }, true)
}
