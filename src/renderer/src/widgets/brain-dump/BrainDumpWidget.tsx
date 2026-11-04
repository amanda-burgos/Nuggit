import { useEffect, useRef, useState } from 'react'
import { t } from '../../../../shared/i18n'
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
      setError(
        result?.error ?? t('Algo salió mal. Intenta otra vez.', 'Something went wrong. Try again.')
      )
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
      finish({
        taskIds: [],
        noteIds: [note.id],
        label: t('Guardado como nota ✓', 'Saved as a note ✓')
      })
    } catch (err) {
      console.error('Could not save the brain dump', err)
      setError(t('No pude guardar. Intenta otra vez.', 'I couldn’t save. Try again.'))
    }
  }

  const saveReviewed = async (): Promise<void> => {
    setError(null)
    const keepTasks = tasks.filter((item) => item.title.trim())
    const keepNotes = notes.map((n) => n.trim()).filter(Boolean)
    try {
      const taskIds: string[] = []
      for (const item of keepTasks) {
        const task = await window.api.tasks.create({ ...item, title: item.title.trim() })
        taskIds.push(task.id)
      }
      const made = await window.api.notes.createMany(keepNotes.map((n) => ({ text: n })))
      const parts = [
        keepTasks.length
          ? plural(keepTasks.length, t('tarea', 'task'), t('tareas', 'tasks'))
          : null,
        made.length ? plural(made.length, t('nota', 'note'), t('notas', 'notes')) : null
      ].filter(Boolean)
      finish({
        taskIds,
        noteIds: made.map((n) => n.id),
        label: t(`${parts.join(' y ')} guardadas ✓`, `${parts.join(' and ')} saved ✓`)
      })
    } catch (err) {
      console.error('Could not save the brain dump', err)
      setError(
        t(
          'No pude guardar todo. Revisa Tareas y Notas.',
          'I couldn’t save everything. Check Tasks and Notes.'
        )
      )
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
  const count =
    tasks.filter((item) => item.title.trim()).length + notes.filter((n) => n.trim()).length

  return (
    <div className={`brain-dump is-${size}`}>
      {phase !== 'review' ? (
        <>
          <textarea
            ref={textRef}
            className="brain-dump-text"
            value={text}
            placeholder={t(
              'Suelta aquí todo lo que tienes en la cabeza, como salga: pendientes, ideas, preocupaciones…',
              'Dump everything on your mind here, however it comes out: to-dos, ideas, worries…'
            )}
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
                {phase === 'sorting'
                  ? t('Dip está ordenando…', 'Dip is sorting…')
                  : t('✨ Ordenar con Dip', '✨ Sort with Dip')}
              </button>
            )}
            <button
              className={hasAI ? 'button-ghost' : 'button-primary'}
              disabled={!text.trim() || phase === 'sorting'}
              onClick={saveAsNote}
            >
              {t('📝 Guardar como nota', '📝 Save as a note')}
            </button>
          </div>
          {!hasAI && (
            <p className="brain-dump-hint">
              {t(
                'Con una IA conectada, Dip lo separa en tareas y notas para que lo revises.',
                'With an AI connected, Dip splits it into tasks and notes for you to review.'
              )}
            </p>
          )}
        </>
      ) : (
        <div className="brain-dump-review">
          <p className="brain-dump-hint">
            {t(
              'Revisa, cambia o quita lo que quieras. Nada se guarda hasta que digas.',
              'Check, change or remove whatever you want. Nothing is saved until you say so.'
            )}
          </p>

          <section aria-label={t('Tareas', 'Tasks')}>
            <h3>{t('✅ Tareas', '✅ Tasks')}</h3>
            {tasks.length === 0 ? (
              <p className="brain-dump-hint">{t('Ninguna.', 'None.')}</p>
            ) : (
              <ul className="brain-dump-list">
                {tasks.map((item, i) => (
                  <li key={i} className="brain-dump-row">
                    <input
                      value={item.title}
                      aria-label={t('Tarea', 'Task')}
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                        )
                      }
                    />
                    <input
                      type="date"
                      value={item.dueDate ?? ''}
                      aria-label={t('Para cuándo', 'Due')}
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((x, j) =>
                            j === i ? { ...x, dueDate: e.target.value || undefined } : x
                          )
                        )
                      }
                    />
                    <button
                      className={`brain-dump-urgent${item.priority === 'high' ? ' is-active' : ''}`}
                      title={t('Urgente', 'Urgent')}
                      aria-pressed={item.priority === 'high'}
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
                      title={t('Quitar', 'Remove')}
                      onClick={() => setTasks((list) => list.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t('Notas', 'Notes')}>
            <h3>{t('📝 Notas', '📝 Notes')}</h3>
            {notes.length === 0 ? (
              <p className="brain-dump-hint">{t('Ninguna.', 'None.')}</p>
            ) : (
              <ul className="brain-dump-list">
                {notes.map((n, i) => (
                  <li key={i} className="brain-dump-row">
                    <textarea
                      value={n}
                      aria-label={t('Nota', 'Note')}
                      onChange={(e) =>
                        setNotes((list) => list.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                    <button
                      className="icon-button"
                      title={t('Quitar', 'Remove')}
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
              {t('Guardar', 'Save')}
            </button>
            <button className="button-ghost" onClick={() => setPhase('write')}>
              {t('Volver a escribir', 'Back to writing')}
            </button>
            <button className="button-ghost" onClick={saveAsNote}>
              {t('Mejor como una nota', 'Just make it a note')}
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
            {t('Deshacer', 'Undo')}
          </button>
        </div>
      )}
    </div>
  )
}
