import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { Note } from '../shared/types'
import { readJson, writeJson } from './storage/jsonStore'

// SPEC 9.7: quick notes, kept in notes.json by the main process so every window shows the
// same ones. Brain Dump (9.6) saves its notes here too.

const MAX_NOTES = 1000
const MAX_TEXT = 10_000

let notes: Note[] = []
let loaded = false

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNote(value: unknown): value is Note {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_TEXT) : ''

function commit(next: Note[]): void {
  notes = next
  if (loaded) {
    writeJson('notes', { version: 1, notes: next }).catch((err) =>
      console.error('[notes] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('notes:changed', next)
}

export async function initNotes(): Promise<void> {
  const data = await readJson<unknown>('notes', null)
  notes = isObject(data) && Array.isArray(data.notes) ? data.notes.filter(isNote) : []
  loaded = true
}

export function getNotes(): Note[] {
  return notes
}

// Several at once (Brain Dump); an empty text is fine for a new quick note.
export function createNotes(inputs: unknown): Note[] {
  if (!Array.isArray(inputs)) return []
  const now = new Date().toISOString()
  const made = inputs.slice(0, Math.max(0, MAX_NOTES - notes.length)).map((input): Note => ({
    id: randomUUID(),
    text: cleanText(isObject(input) ? input.text : undefined),
    createdAt: now,
    updatedAt: now
  }))
  if (made.length) commit([...notes, ...made])
  return made
}

export function createNote(input: unknown): Note {
  const [note] = createNotes([input ?? {}])
  if (!note) throw new Error('Too many notes')
  return note
}

export function updateNote(id: unknown, patch: unknown): void {
  const current = notes.find((n) => n.id === id)
  if (!current || !isObject(patch) || typeof patch.text !== 'string') return
  const text = cleanText(patch.text)
  if (text === current.text) return
  const next = { ...current, text, updatedAt: new Date().toISOString() }
  commit(notes.map((n) => (n.id === current.id ? next : n)))
}

// Returns what was removed, so it can be put back with restoreNotes (Deshacer).
export function removeNotes(ids: unknown): Note[] {
  if (!Array.isArray(ids)) return []
  const doomed = new Set(ids.filter((id): id is string => typeof id === 'string'))
  const removed = notes.filter((n) => doomed.has(n.id))
  if (removed.length) commit(notes.filter((n) => !doomed.has(n.id)))
  return removed
}

export function restoreNotes(input: unknown): void {
  if (!Array.isArray(input)) return
  const known = new Set(notes.map((n) => n.id))
  const back = input.filter((n): n is Note => isNote(n) && !known.has(n.id))
  if (back.length) commit([...notes, ...back.map((n) => ({ ...n, text: cleanText(n.text) }))])
}
