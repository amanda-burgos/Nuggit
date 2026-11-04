import { useEffect, useMemo, useRef, useState } from 'react'
import { locale, t } from '../../../../shared/i18n'
import type { Note } from '../../../../shared/types'
import { onNoteFocusRequest, takeNoteFocus, useNotes } from '../../store/useNotes'
import type { WidgetProps } from '../types'
import { formatShortcut } from '../../../../shared/keys'

const NEW_NOTE = formatShortcut('CommandOrControl+N')
import './notes.css'

// Notes have no options yet.
export type NotesConfig = Record<string, never>

const UNDO_MS = 8000
const SAVE_DELAY_MS = 500

// SPEC 9.7: a new note is one click ("+ Nota") or ⌘N from anywhere in the app. Notes save
// as you type; an empty note goes away on its own when you leave it.
export function NotesWidget({ size }: WidgetProps<NotesConfig>): React.JSX.Element {
  const notes = useNotes()
  const [query, setQuery] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [undo, setUndo] = useState<Note[] | null>(null)

  // A note made with ⌘N (or from another window) gets the cursor once it shows up.
  useEffect(() => {
    const take = (): void => {
      const id = takeNoteFocus()
      if (id) setFocusId(id)
    }
    take()
    return onNoteFocusRequest(take)
  }, [])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  // Newest first; while searching, only the notes that contain every word.
  const shown = useMemo(() => {
    const words = normalize(query).split(' ').filter(Boolean)
    return [...(notes ?? [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((n) => n.id === focusId || words.every((w) => normalize(n.text).includes(w)))
  }, [notes, query, focusId])

  if (!notes) return <div className="notes" />

  const add = async (): Promise<void> => {
    setQuery('')
    try {
      const note = await window.api.notes.create()
      setFocusId(note.id)
    } catch (err) {
      console.error('Could not create a note', err)
    }
  }

  const remove = async (note: Note, quiet: boolean): Promise<void> => {
    const removed = await window.api.notes.remove([note.id]).catch(() => [])
    if (!quiet && removed.length) setUndo(removed)
  }

  return (
    <div className={`notes is-${size}`}>
      <div className="notes-bar">
        <button
          className="button-primary"
          onClick={add}
          title={t(`Nueva nota (${NEW_NOTE})`, `New note (${NEW_NOTE})`)}
        >
          {t('+ Nota', '+ Note')}
        </button>
        {notes.length > 3 && (
          <input
            type="search"
            value={query}
            placeholder={t('Buscar…', 'Search…')}
            aria-label={t('Buscar en las notas', 'Search notes')}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {notes.length === 0 ? (
        <p className="notes-hint">
          {t(
            'Anota lo que sea, rápido. Desde cualquier pestaña:',
            'Jot down anything, fast. From any tab:'
          )}{' '}
          <kbd>{formatShortcut('CommandOrControl+N')}</kbd>.
        </p>
      ) : shown.length === 0 ? (
        <p className="notes-hint">{t('Ninguna nota tiene eso.', 'No note has that.')}</p>
      ) : (
        <ul className="notes-list">
          {shown.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              focus={note.id === focusId}
              onFocused={() => setFocusId(null)}
              onRemove={(quiet) => remove(note, quiet)}
            />
          ))}
        </ul>
      )}

      {undo && (
        <div className="notes-undo" role="status">
          <span>{t('Nota borrada', 'Note deleted')}</span>
          <button
            className="button-ghost"
            onClick={() => {
              window.api.notes.restore(undo).catch((err) => console.error(err))
              setUndo(null)
            }}
          >
            {t('Deshacer', 'Undo')}
          </button>
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  focus,
  onFocused,
  onRemove
}: {
  note: Note
  focus: boolean
  onFocused(): void
  onRemove(quiet: boolean): void
}): React.JSX.Element {
  // What is being typed here; null when not editing, to show changes from other windows.
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? note.text
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!focus || !ref.current) return
    ref.current.focus()
    ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length)
    onFocused()
  }, [focus, onFocused])

  const save = (value: string): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (value !== note.text) {
      window.api.notes.update(note.id, { text: value }).catch((err) => console.error(err))
    }
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return (
    <li className="note-card">
      <textarea
        ref={ref}
        value={text}
        placeholder={t('Escribe tu nota…', 'Write your note…')}
        aria-label={t('Nota', 'Note')}
        onFocus={() => setDraft(note.text)}
        onChange={(e) => {
          const value = e.target.value
          setDraft(value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => save(value), SAVE_DELAY_MS)
        }}
        onBlur={() => {
          setDraft(null)
          // An empty note isn't worth keeping (nor an "undo" toast).
          if (!text.trim()) onRemove(true)
          else save(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      <div className="note-meta">
        <small>{describeDate(note.updatedAt)}</small>
        <button
          className="icon-button"
          title={t('Borrar nota', 'Delete note')}
          onClick={() => onRemove(false)}
        >
          ×
        </button>
      </div>
    </li>
  )
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function describeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return t(`Hoy, ${time}`, `Today, ${time}`)
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString())
    return t(`Ayer, ${time}`, `Yesterday, ${time}`)
  return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}
