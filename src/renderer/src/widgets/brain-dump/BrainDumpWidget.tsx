import { useEffect, useRef, useState } from 'react'
import type { BrainDumpTask } from '../../../../shared/types'
import { useAIStatus } from '../../store/useAIStatus'
import { MicButton } from '../../voice/MicButton'
import type { WidgetProps } from '../types'
import './brain-dump.css'

// Brain Dump has no options yet.
export type BrainDumpConfig = Record<string, never>

type Phase = 'write' | 'sorting' | 'review'

interface Saved {
  taskIds: string[]
  noteIds: string[]
  label: string
}

const UNDO_MS = 8000
// What you were writing survives closing the widget or switching tabs (this computer only).
const DRAFT_KEY = 'nuggit.brainDump.draft'

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveDraft(text: string): void {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // it's only a convenience
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// SPEC 9.6: let it all out in one box. With AI, Dip splits it into tasks and notes to
// review before saving; without AI (or if you prefer), it is saved as one note.
export function BrainDumpWidget({ size }: WidgetProps<BrainDumpConfig>): React.JSX.Element {
  const aiStatus = useAIStatus()
  const [text, setText] = useState(loadDraft)
  const [phase, setPhase] = useState<Phase>('write')
  const [tasks, setTasks] = useState<BrainDumpTask[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => saveDraft(text), [text])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const sort = async (): Promise<void> => {
    setError(null)
    setPhase('sorting')
    const result = await window.api.ai.brainDump(text).catch(() => null)
    if (!result?.ok) {
      setError(result?.error ?? 'Algo salió mal. Intenta otra vez.')
      return setPhase('write')
    }
    setTasks(result.tasks)
    setNotes(result.notes)
    setPhase('review')
  }

  const finish = (result: Saved): void => {
    setText('')
    setTasks([])
    setNotes([])
    setPhase('write')
    setSaved(result)
  }

  const saveAsNote = async (): Promise<void> => {
    setError(null)
    try {
      const note = await window.api.notes.create({ text: text.trim() })
      finish({ taskIds: [], noteIds: [note.id], label: 'Guardado como nota ✓' })
    } catch (err) {
      console.error('Could not save the brain dump', err)
      setError('No pude guardar. Intenta otra vez.')
    }
  }

  const saveReviewed = async (): Promise<void> => {
    setError(null)
    const keepTasks = tasks.filter((t) => t.title.trim())
    const keepNotes = notes.map((n) => n.trim()).filter(Boolean)
    try {
      const taskIds: string[] = []
      for (const t of keepTasks) {
        const task = await window.api.tasks.create({ ...t, title: t.title.trim() })
        taskIds.push(task.id)
      }
      const made = await window.api.notes.createMany(keepNotes.map((n) => ({ text: n })))
      const parts = [
        keepTasks.length ? plural(keepTasks.length, 'tarea', 'tareas') : null,
        made.length ? plural(made.length, 'nota', 'notas') : null
      ].filter(Boolean)
      finish({
        taskIds,
        noteIds: made.map((n) => n.id),
        label: `${parts.join(' y ')} guardadas ✓`
      })
    } catch (err) {
      console.error('Could not save the brain dump', err)
      setError('No pude guardar todo. Revisa Tareas y Notas.')
    }
  }

  const undo = async (): Promise<void> => {
    if (!saved) return
    setSaved(null)
    try {
      for (const id of saved.taskIds) await window.api.tasks.remove(id)
      await window.api.notes.remove(saved.noteIds)
    } catch (err) {
      console.error('Could not undo the brain dump', err)
    }
  }

  const hasAI = Boolean(aiStatus?.active)
  const count = tasks.filter((t) => t.title.trim()).length + notes.filter((n) => n.trim()).length

  return (
    <div className={`brain-dump is-${size}`}>
      {phase !== 'review' ? (
        <>
          <textarea
            ref={textRef}
            className="brain-dump-text"
            value={text}
            placeholder="Suelta aquí todo lo que tienes en la cabeza, como salga: pendientes, ideas, preocupaciones…"
            aria-label="Brain Dump"
            disabled={phase === 'sorting'}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="brain-dump-actions">
            <MicButton target={textRef} disabled={phase === 'sorting'} />
            {hasAI && (
              <button
                className="button-primary"
                disabled={!text.trim() || phase === 'sorting'}
                onClick={sort}
              >
                {phase === 'sorting' ? 'Dip está ordenando…' : '✨ Ordenar con Dip'}
              </button>
            )}
            <button
              className={hasAI ? 'button-ghost' : 'button-primary'}
              disabled={!text.trim() || phase === 'sorting'}
              onClick={saveAsNote}
            >
              📝 Guardar como nota
            </button>
          </div>
          {!hasAI && (
            <p className="brain-dump-hint">
              Con una IA conectada, Dip lo separa en tareas y notas para que lo revises.
            </p>
          )}
        </>
      ) : (
        <div className="brain-dump-review">
          <p className="brain-dump-hint">
            Revisa, cambia o quita lo que quieras. Nada se guarda hasta que digas.
          </p>

          <section aria-label="Tareas">
            <h3>✅ Tareas</h3>
            {tasks.length === 0 ? (
              <p className="brain-dump-hint">Ninguna.</p>
            ) : (
              <ul className="brain-dump-list">
                {tasks.map((t, i) => (
                  <li key={i} className="brain-dump-row">
                    <input
                      value={t.title}
                      aria-label="Tarea"
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                        )
                      }
                    />
                    <input
                      type="date"
                      value={t.dueDate ?? ''}
                      aria-label="Para cuándo"
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((x, j) =>
                            j === i ? { ...x, dueDate: e.target.value || undefined } : x
                          )
                        )
                      }
                    />
                    <button
                      className={`brain-dump-urgent${t.priority === 'high' ? ' is-active' : ''}`}
                      title="Urgente"
                      aria-pressed={t.priority === 'high'}
                      onClick={() =>
                        setTasks((list) =>
                          list.map((x, j) =>
                            j === i
                              ? { ...x, priority: x.priority === 'high' ? undefined : 'high' }
                              : x
                          )
                        )
                      }
                    >
                      ❗
                    </button>
                    <button
                      className="icon-button"
                      title="Quitar"
                      onClick={() => setTasks((list) => list.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Notas">
            <h3>📝 Notas</h3>
            {notes.length === 0 ? (
              <p className="brain-dump-hint">Ninguna.</p>
            ) : (
              <ul className="brain-dump-list">
                {notes.map((n, i) => (
                  <li key={i} className="brain-dump-row">
                    <textarea
                      value={n}
                      aria-label="Nota"
                      onChange={(e) =>
                        setNotes((list) => list.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                    <button
                      className="icon-button"
                      title="Quitar"
                      onClick={() => setNotes((list) => list.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="brain-dump-actions">
            <button className="button-primary" disabled={count === 0} onClick={saveReviewed}>
              Guardar
            </button>
            <button className="button-ghost" onClick={() => setPhase('write')}>
              Volver a escribir
            </button>
            <button className="button-ghost" onClick={saveAsNote}>
              Mejor como una nota
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="brain-dump-error" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <div className="brain-dump-undo" role="status">
          <span>{saved.label}</span>
          <button className="button-ghost" onClick={undo}>
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
