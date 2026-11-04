import { useEffect, useMemo, useState } from 'react'
import { locale, t } from '../../../../shared/i18n'
import type { TaskStatusChange } from '../../../../shared/types'
import { pickNextActions, type NextAction } from '../../../../shared/nextAction'
import { useNextAction } from '../../store/useNextAction'
import { useTasks } from '../../store/useTasks'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import './next-action.css'

// Next Action has no options yet.
export type NextActionConfig = Record<string, never>

// "Tengo…": how much time the user has right now (null = no limit).
const timeOptions = (): Array<{ minutes: number | null; label: string }> => [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: null, label: t('Sin límite', 'No limit') }
]

const TINY_MS = 2 * 60_000
const UNDO_MS = 6000

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
}

// "Hoy", "Mañana", "Ayer", or a short date like "14 oct".
function formatDue(dueDate: string, today: string): string {
  const day = new Date(`${dueDate}T00:00:00`)
  const diff = Math.round((day.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  if (diff === 0) return t('Hoy', 'Today')
  if (diff === 1) return t('Mañana', 'Tomorrow')
  if (diff < 0)
    return diff === -1 ? t('Era para ayer', 'Was due yesterday') : t('Era para antes', 'Overdue')
  return day.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

function meta(action: NextAction, today: string): string[] {
  return [
    action.minutes ? `⏱ ${formatMinutes(action.minutes)}` : null,
    action.root.dueDate ? `📅 ${formatDue(action.root.dueDate, today)}` : null,
    action.root.priority === 'high' ? t('Prioridad alta', 'High priority') : null
  ].filter((m): m is string => Boolean(m))
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Tiny {
  taskId: string
  text: string | null // null while Dip thinks
  endsAt: number
}

// SPEC 9.5: "¿Qué hago ahora?". One thing to do (and at most two after it), chosen with
// simple rules, no AI needed. The menu bar shows the same task and step.
export function NextActionWidget({ size }: WidgetProps<NextActionConfig>): React.JSX.Element {
  const { tasks } = useTasks()
  const state = useNextAction()
  const today = useToday()
  const [tiny, setTiny] = useState<Tiny | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [undo, setUndo] = useState<{ changes: TaskStatusChange[]; label: string } | null>(null)

  const actions = useMemo(
    () => (tasks && state ? pickNextActions(tasks, state, today) : []),
    [tasks, state, today]
  )
  const [top, ...later] = actions
  const tinyHere = tiny && top && tiny.taskId === top.task.id ? tiny : null

  // The 2-minute countdown of "Solo empieza".
  useEffect(() => {
    if (!tinyHere || now >= tinyHere.endsAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [tinyHere, now])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  if (!tasks || !state) return <div className="next-action" />

  const hasPending = tasks.some((t) => !t.parentId && t.status !== 'done')

  const done = (action: NextAction): void => {
    setTiny(null)
    window.api.tasks
      .complete(action.task.id)
      .then((changes) => {
        if (!changes.length) return
        const label =
          changes.length > 1
            ? t('¡Tarea terminada! 🎉', 'Task finished! 🎉')
            : action.task === action.root
              ? t('¡Hecho! ✅', 'Done! ✅')
              : t('¡Paso hecho! ✅', 'Step done! ✅')
        setUndo({ changes, label })
      })
      .catch((err) => console.error('Could not complete task', err))
  }

  const skip = (action: NextAction): void => {
    setTiny(null)
    window.api.nextAction.skip(action.task.id).catch((err) => console.error(err))
  }

  const start = (action: NextAction): void => {
    window.api.nextAction.start(action.task.id).catch((err) => console.error(err))
  }

  // "Solo empieza": the step as something that takes 2 minutes, with a little countdown.
  const justStart = (action: NextAction): void => {
    const taskId = action.task.id
    const begin = Date.now()
    setNow(begin)
    setTiny({ taskId, text: null, endsAt: begin + TINY_MS })
    start(action)
    window.api.nextAction
      .tinyStep(taskId)
      .then((result) => setTiny((t) => (t?.taskId === taskId ? { ...t, text: result.text } : t)))
      .catch(() =>
        setTiny((cur) =>
          cur?.taskId === taskId
            ? {
                ...cur,
                text: t(
                  'Hazlo solo 2 minutos. Lo que salga, cuenta.',
                  'Do it for just 2 minutes. Whatever you get done counts.'
                )
              }
            : cur
        )
      )
  }

  const setAvailable = (minutes: number | null): void => {
    window.api.nextAction.setAvailable(minutes).catch((err) => console.error(err))
  }

  return (
    <div className={`next-action is-${size}`}>
      {hasPending && (
        <div
          className="next-action-time"
          role="group"
          aria-label={t('¿Cuánto tiempo tienes?', 'How much time do you have?')}
        >
          <span className="next-action-time-label">{t('Tengo', 'I have')}</span>
          {timeOptions().map((o) => (
            <button
              key={o.label}
              className={`next-action-chip${state.availableMin === o.minutes ? ' is-active' : ''}`}
              aria-pressed={state.availableMin === o.minutes}
              onClick={() => setAvailable(o.minutes)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {top ? (
        <article className={`next-action-card${top.started ? ' is-started' : ''}`}>
          <div className="next-action-from">
            {top.started && (
              <span className="next-action-badge">{t('En curso', 'In progress')}</span>
            )}
            {top.task !== top.root && (
              <span>
                {top.root.title} ·{' '}
                {t(
                  `Paso ${top.stepNumber} de ${top.stepCount}`,
                  `Step ${top.stepNumber} of ${top.stepCount}`
                )}
              </span>
            )}
          </div>
          <h2 className="next-action-title">{top.task.title}</h2>
          {meta(top, today).length > 0 && (
            <div className="next-action-meta">
              {meta(top, today).map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}

          {tinyHere && (
            <div className="next-action-tiny" aria-live="polite">
              <span className="next-action-tiny-label">
                {t('⚡ Solo 2 minutos', '⚡ Just 2 minutes')}
                <span className="next-action-countdown">
                  {now < tinyHere.endsAt ? countdown(tinyHere.endsAt - now) : t('¡Listo!', 'Done!')}
                </span>
              </span>
              <p>{tinyHere.text ?? t('Dip está pensando…', 'Dip is thinking…')}</p>
              {now >= tinyHere.endsAt && (
                <p className="next-action-tiny-end">
                  {t(
                    '¡Lo hiciste! ¿Sigues un rato más o ya está? 💪',
                    'You did it! Keep going a bit more, or are you done? 💪'
                  )}
                </p>
              )}
            </div>
          )}

          <div className="next-action-buttons">
            {top.started ? (
              <button className="button-primary" onClick={() => done(top)}>
                {t('✅ Hecho', '✅ Done')}
              </button>
            ) : (
              <button className="button-primary" onClick={() => start(top)}>
                {t('Empezar', 'Start')}
              </button>
            )}
            {!top.started && (
              <button className="button-ghost" onClick={() => done(top)}>
                {t('✅ Hecho', '✅ Done')}
              </button>
            )}
            <button className="button-ghost" onClick={() => skip(top)}>
              {t('Saltar', 'Skip')}
            </button>
            {!tinyHere && (
              <button
                className="button-ghost"
                title={t(
                  'Una versión de 2 minutos, para arrancar',
                  'A 2-minute version, to get going'
                )}
                onClick={() => justStart(top)}
              >
                {t('Solo empieza', 'Just start')}
              </button>
            )}
          </div>

          {top.nextStep && (
            <p className="next-action-after">
              {t('Siguiente paso:', 'Next step:')} <span>{top.nextStep.title}</span>
            </p>
          )}
        </article>
      ) : (
        <div className="next-action-empty">
          {hasPending && state.availableMin ? (
            <>
              <p>
                {t(
                  `Nada cabe en ${formatMinutes(state.availableMin)} ⏳`,
                  `Nothing fits in ${formatMinutes(state.availableMin)} ⏳`
                )}
              </p>
              <p className="next-action-hint">
                {t(
                  'Prueba con más tiempo, o divide algo grande en pasitos con Tenders.',
                  'Try with more time, or break something big into tiny steps with Tenders.'
                )}
              </p>
              <button className="button-ghost" onClick={() => setAvailable(null)}>
                {t('Ver sin límite', 'Show with no limit')}
              </button>
            </>
          ) : (
            <>
              <p>{t('Nada pendiente 🎉', 'Nothing to do 🎉')}</p>
              <p className="next-action-hint">
                {t(
                  'Cuando anotes una tarea, aquí te digo por dónde empezar.',
                  'When you add a task, I’ll tell you where to start here.'
                )}
              </p>
            </>
          )}
        </div>
      )}

      {later.length > 0 && (
        <section className="next-action-later" aria-label={t('Después', 'Later')}>
          <h3>{t('Después', 'Later')}</h3>
          <ul>
            {later.map((a) => (
              <li key={a.task.id}>
                <span className="next-action-later-title">
                  {a.task.title}
                  {a.task !== a.root && (
                    <span className="next-action-later-root"> · {a.root.title}</span>
                  )}
                </span>
                {a.minutes ? <span className="next-action-later-min">{a.minutes} min</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {undo && (
        <div className="next-action-undo" role="status">
          <span>{undo.label}</span>
          <button
            className="button-ghost"
            onClick={() => {
              window.api.tasks.restoreStatuses(undo.changes).catch((err) => console.error(err))
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
