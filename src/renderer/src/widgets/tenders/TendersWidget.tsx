import { useState } from 'react'
import type { Task, TenderAnswer, TenderStep } from '../../../../shared/types'
import { useAIStatus } from '../../store/useAIStatus'
import type { WidgetProps } from '../types'
import { StepsEditor, type EditableStep } from './StepsEditor'
import './tenders.css'

// Tenders has no options yet.
export type TendersConfig = Record<string, never>

type Phase =
  | { kind: 'start' }
  | { kind: 'asking' }
  | { kind: 'questions'; answers: TenderAnswer[] }
  | { kind: 'planning'; answers: TenderAnswer[] }
  | { kind: 'steps'; answers: TenderAnswer[] }
  | { kind: 'saved'; saved: Task[] }

let nextKey = 1
const editable = (steps: TenderStep[]): EditableStep[] =>
  steps.map((s) => ({ ...s, key: nextKey++ }))

// SPEC 9.3: write a big task, answer 2 or 3 short questions from Dip, then edit the small
// steps Dip proposes and save them. Without AI (or if it fails) the steps are written by hand.
export function TendersWidget({ size }: WidgetProps<TendersConfig>): React.JSX.Element {
  const aiStatus = useAIStatus()
  const hasAI = Boolean(aiStatus?.active)
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })
  const [task, setTask] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [steps, setSteps] = useState<EditableStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null) // "Cambiar" box, when open

  const reset = (): void => {
    setPhase({ kind: 'start' })
    setTask('')
    setError(null)
    setFeedback(null)
  }

  const byHand = (answers: TenderAnswer[] = []): void => {
    setTitle(task.trim())
    setDueDate('')
    setSteps(editable([{ title: '', minutes: 10 }]))
    setError(null)
    setPhase({ kind: 'steps', answers })
  }

  const askQuestions = async (): Promise<void> => {
    setError(null)
    setPhase({ kind: 'asking' })
    const result = await window.api.ai.tenderQuestions(task)
    if (!result.ok) {
      setError(result.error)
      return setPhase({ kind: 'start' })
    }
    setPhase({
      kind: 'questions',
      answers: result.questions.map((question) => ({ question, answer: '' }))
    })
  }

  const plan = async (answers: TenderAnswer[], change?: string): Promise<void> => {
    setError(null)
    setPhase({ kind: 'planning', answers })
    const result = await window.api.ai.proposeTenders({
      task,
      answers,
      ...(change
        ? { feedback: change, previous: steps.map(({ title, minutes }) => ({ title, minutes })) }
        : {})
    })
    if (!result.ok) {
      setError(result.error)
      // Keep what the user had: back to the steps if there were some, else the questions.
      return setPhase(change ? { kind: 'steps', answers } : { kind: 'questions', answers })
    }
    setTitle(result.title)
    setDueDate(result.dueDate ?? '')
    setSteps(editable(result.steps))
    setFeedback(null)
    setPhase({ kind: 'steps', answers })
  }

  const save = async (): Promise<void> => {
    const clean = steps
      .map((s) => ({ title: s.title.trim(), minutes: s.minutes }))
      .filter((s) => s.title)
    if (!title.trim() || clean.length === 0) return
    try {
      const saved = await window.api.tasks.createWithSteps({
        title: title.trim(),
        ...(dueDate ? { dueDate } : {}),
        steps: clean
      })
      setPhase({ kind: 'saved', saved })
    } catch (err) {
      console.error('Could not save tenders', err)
      setError('No pude guardar. Intenta otra vez.')
    }
  }

  const undoSave = async (saved: Task[]): Promise<void> => {
    await window.api.tasks.remove(saved[0].id).catch((err) => console.error('Could not undo', err))
    setPhase({ kind: 'steps', answers: [] })
  }

  const className = `tenders${size === 'full' ? ' is-full' : ''}`
  const errorBox = error && (
    <p className="tenders-error" role="alert">
      {error}
    </p>
  )

  // --- 1. Write the big task ---
  if (phase.kind === 'start' || phase.kind === 'asking') {
    const busy = phase.kind === 'asking'
    return (
      <div className={className}>
        <form
          className="tenders-start"
          onSubmit={(e) => {
            e.preventDefault()
            if (task.trim() && !busy) hasAI ? askQuestions() : byHand()
          }}
        >
          <label htmlFor="tenders-task">¿Qué tarea grande quieres dividir?</label>
          <input
            id="tenders-task"
            value={task}
            placeholder='Ej: "proyecto de ciencias"'
            disabled={busy}
            onChange={(e) => setTask(e.target.value)}
          />
          <div className="tenders-actions">
            {hasAI && (
              <button type="submit" className="button-primary" disabled={!task.trim() || busy}>
                {busy ? 'Dip está pensando…' : '🪜 Dividir con Dip'}
              </button>
            )}
            <button
              type={hasAI ? 'button' : 'submit'}
              className={hasAI ? 'button-ghost' : 'button-primary'}
              disabled={!task.trim() || busy}
              onClick={hasAI ? () => byHand() : undefined}
            >
              Hacer los pasos a mano
            </button>
          </div>
        </form>
        {errorBox}
        {!hasAI && aiStatus && (
          <p className="tenders-hint">
            Sin IA puedes escribir los pasos tú. Para que Dip te ayude, abre Ollama o conecta Gemini
            en Ajustes.
          </p>
        )}
        <p className="tenders-hint">
          Dip te hace 2 o 3 preguntas y te propone pasos chiquitos de 5 a 25 minutos. Tú decides
          cuáles se guardan.
        </p>
      </div>
    )
  }

  // --- 2. Answer Dip's questions ---
  if (phase.kind === 'questions' || phase.kind === 'planning') {
    const busy = phase.kind === 'planning'
    const setAnswer = (i: number, answer: string): void =>
      setPhase({
        kind: 'questions',
        answers: phase.answers.map((a, j) => (j === i ? { ...a, answer } : a))
      })
    return (
      <div className={className}>
        <p className="tenders-task">🪜 {task}</p>
        <form
          className="tenders-questions"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) plan(phase.answers)
          }}
        >
          {phase.answers.map((a, i) => (
            <label key={i} className="tenders-question">
              <span>{a.question}</span>
              <input
                value={a.answer}
                disabled={busy}
                autoFocus={i === 0}
                placeholder="Tu respuesta (puedes dejarla vacía)"
                onChange={(e) => setAnswer(i, e.target.value)}
              />
            </label>
          ))}
          <div className="tenders-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              {busy ? 'Dip está armando los pasos…' : 'Ver los pasos'}
            </button>
            <button type="button" className="button-ghost" disabled={busy} onClick={reset}>
              Cancelar
            </button>
          </div>
        </form>
        {busy && (
          <p className="tenders-hint">Con Ollama esto puede tardar hasta un minuto. ¡Ya casi! ⏳</p>
        )}
        {errorBox}
        {error && !busy && (
          <button className="button-ghost" onClick={() => byHand(phase.answers)}>
            Hacer los pasos a mano
          </button>
        )}
      </div>
    )
  }

  // --- 4. Saved ---
  if (phase.kind === 'saved') {
    const [parent, ...children] = phase.saved
    return (
      <div className={`${className} tenders-done`}>
        <p className="tenders-done-title">¡Listo! ✅</p>
        <p>
          Guardé &quot;{parent.title}&quot; con {children.length}{' '}
          {children.length === 1 ? 'paso' : 'pasos'} en Tareas. Empieza por el primero: es el más
          fácil.
        </p>
        <div className="tenders-actions">
          <button className="button-primary" onClick={reset}>
            Dividir otra tarea
          </button>
          <button className="button-ghost" onClick={() => undoSave(phase.saved)}>
            Deshacer
          </button>
        </div>
      </div>
    )
  }

  // --- 3. Edit the steps, then [Guardar] [Cambiar] [Cancelar] ---
  const filled = steps.filter((s) => s.title.trim())
  const total = filled.reduce((sum, s) => sum + s.minutes, 0)
  const canSave = Boolean(title.trim()) && filled.length > 0
  return (
    <div className={className}>
      <div className="tenders-card">
        <label className="tenders-field">
          <span>Tarea</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="tenders-field is-date">
          <span>Para cuándo</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <StepsEditor steps={steps} onChange={setSteps} />
        <p className="tenders-hint">
          {filled.length} {filled.length === 1 ? 'paso' : 'pasos'} · {total} min en total
        </p>

        {errorBox}

        {feedback !== null && (
          <form
            className="tenders-feedback"
            onSubmit={(e) => {
              e.preventDefault()
              if (feedback.trim()) plan(phase.answers, feedback.trim())
            }}
          >
            <input
              value={feedback}
              autoFocus
              placeholder='¿Qué cambio? Ej: "menos pasos" o "más cortos"'
              onChange={(e) => setFeedback(e.target.value)}
            />
            <button type="submit" className="button-primary" disabled={!feedback.trim()}>
              Pedir cambio
            </button>
          </form>
        )}

        <div className="tenders-actions">
          <button className="button-primary" disabled={!canSave} onClick={save}>
            Guardar
          </button>
          {hasAI && feedback === null && (
            <button className="button-ghost" onClick={() => setFeedback('')}>
              Cambiar
            </button>
          )}
          <button className="button-ghost" onClick={reset}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
