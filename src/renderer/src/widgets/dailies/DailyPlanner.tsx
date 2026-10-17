import { useState } from 'react'
import type { Daily, TenderAnswer } from '../../../../shared/types'
import { describeRepeat } from '../../../../shared/dailies'
import { DailyEditor, type DailyDraft } from './DailyEditor'

type Phase =
  | { kind: 'start' }
  | { kind: 'asking' }
  | { kind: 'questions'; answers: TenderAnswer[] }
  | { kind: 'planning'; answers: TenderAnswer[] }
  | { kind: 'review'; answers: TenderAnswer[] }

// SPEC 9.13, "Planear con Dip": say what routine you want, answer 2 or 3 short questions,
// then edit Dip's proposal and approve it. Nothing is saved until "Guardar".
export function DailyPlanner({
  onDone,
  onClose
}: {
  onDone(saved: Daily[]): void
  onClose(): void
}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })
  const [request, setRequest] = useState('')
  const [drafts, setDrafts] = useState<DailyDraft[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ask = async (): Promise<void> => {
    setError(null)
    setPhase({ kind: 'asking' })
    const result = await window.api.ai.dailyQuestions(request).catch(() => null)
    if (!result?.ok) {
      setError(result?.error ?? 'Algo salió mal. Intenta otra vez.')
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
    const result = await window.api.ai
      .proposeDailies({
        request,
        answers,
        ...(change ? { feedback: change, previous: drafts } : {})
      })
      .catch(() => null)
    if (!result?.ok) {
      setError(result?.error ?? 'Algo salió mal. Intenta otra vez.')
      return setPhase(change ? { kind: 'review', answers } : { kind: 'questions', answers })
    }
    setDrafts(result.dailies)
    setFeedback(null)
    setEditing(null)
    setPhase({ kind: 'review', answers })
  }

  const save = async (): Promise<void> => {
    try {
      const saved = await window.api.dailies.createMany(drafts)
      onDone(saved)
    } catch (err) {
      console.error('Could not save dailies', err)
      setError('No pude guardar. Intenta otra vez.')
    }
  }

  return (
    <div className="daily-planner">
      <div className="daily-planner-head">
        <strong>✨ Planear con Dip</strong>
        <button className="icon-button" title="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>

      {(phase.kind === 'start' || phase.kind === 'asking') && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (request.trim()) ask()
          }}
        >
          <textarea
            rows={2}
            value={request}
            placeholder='Ej: "ayúdame a armar mi rutina de la semana"'
            aria-label="Qué rutina quieres"
            autoFocus
            disabled={phase.kind === 'asking'}
            onChange={(e) => setRequest(e.target.value)}
          />
          <button
            type="submit"
            className="button-primary"
            disabled={!request.trim() || phase.kind === 'asking'}
          >
            {phase.kind === 'asking' ? 'Dip está pensando…' : 'Siguiente'}
          </button>
        </form>
      )}

      {(phase.kind === 'questions' || (phase.kind === 'planning' && drafts.length === 0)) && (
        <form
          className="daily-planner-questions"
          onSubmit={(e) => {
            e.preventDefault()
            plan(phase.answers)
          }}
        >
          {phase.answers.map((a, i) => (
            <label key={i}>
              <span>{a.question}</span>
              <input
                value={a.answer}
                disabled={phase.kind === 'planning'}
                onChange={(e) =>
                  setPhase({
                    kind: 'questions',
                    answers: phase.answers.map((x, j) =>
                      j === i ? { ...x, answer: e.target.value } : x
                    )
                  })
                }
              />
            </label>
          ))}
          <button type="submit" className="button-primary" disabled={phase.kind === 'planning'}>
            {phase.kind === 'planning' ? 'Dip está armando tu rutina…' : 'Proponer dailies'}
          </button>
        </form>
      )}

      {(phase.kind === 'review' || (phase.kind === 'planning' && drafts.length > 0)) && (
        <div className="daily-planner-review">
          <p className="daily-hint">
            Revisa, cambia o quita lo que quieras. Nada se guarda hasta que digas.
          </p>
          <ul className="daily-list">
            {drafts.map((d, i) =>
              editing === i ? (
                <li key={i}>
                  <DailyEditor
                    initial={d}
                    saveLabel="Listo"
                    onSave={(next) => {
                      setDrafts((list) => list.map((x, j) => (j === i ? next : x)))
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={i} className="daily-row">
                  <span className="daily-row-main">
                    <span className="daily-title">{d.title}</span>
                    <small>
                      {describeRepeat(d.repeat)}
                      {d.time ? ` · ${d.time}` : ''}
                      {d.estimateMin ? ` · ${d.estimateMin} min` : ''}
                    </small>
                  </span>
                  <button className="icon-button" title="Editar" onClick={() => setEditing(i)}>
                    ✏️
                  </button>
                  <button
                    className="icon-button"
                    title="Quitar"
                    onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </li>
              )
            )}
          </ul>

          {feedback !== null ? (
            <form
              className="daily-planner-feedback"
              onSubmit={(e) => {
                e.preventDefault()
                if (feedback.trim() && phase.kind === 'review') plan(phase.answers, feedback.trim())
              }}
            >
              <input
                value={feedback}
                placeholder='Ej: "el gimnasio mejor martes y jueves"'
                aria-label="Qué cambiar"
                autoFocus
                disabled={phase.kind === 'planning'}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <button type="submit" className="button-primary" disabled={phase.kind === 'planning'}>
                {phase.kind === 'planning' ? 'Cambiando…' : 'Pedir cambio'}
              </button>
            </form>
          ) : (
            <div className="daily-editor-buttons">
              <button className="button-primary" disabled={drafts.length === 0} onClick={save}>
                Guardar
              </button>
              <button className="button-ghost" onClick={() => setFeedback('')}>
                Cambiar
              </button>
              <button className="button-ghost" onClick={onClose}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="daily-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
