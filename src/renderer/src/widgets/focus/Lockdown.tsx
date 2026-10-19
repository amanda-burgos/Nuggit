import { useEffect } from 'react'
import { formatClock, useFocus, useTimeLeft } from '../../store/useFocus'
import { FocusControls } from './FocusWidget'
import { completeFocusTask, useFocusTask } from './useFocusTask'
import './focus.css'

const exit = (): void => {
  window.api.focus.setLockdown(false).catch((err) => console.error('[lockdown]', err))
}

// SPEC 9.9: only the task, the timer and the next step, over the whole window. It only
// lives inside Nuggit (nothing else is blocked) and the way out is always there: the
// button, or Esc.
export function Lockdown(): React.JSX.Element | null {
  const focus = useFocus()
  const left = useTimeLeft(focus)
  const { action } = useFocusTask(focus)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!focus) return null
  const paused = focus.pausedLeftMs !== null

  return (
    <div className="lockdown" role="dialog" aria-modal="true" aria-label="Lockdown">
      <button className="lockdown-exit button-ghost" onClick={exit}>
        Salir <kbd>Esc</kbd>
      </button>

      <div className="lockdown-body">
        {action ? (
          <>
            {action.task !== action.root && (
              <small className="lockdown-root">
                {action.root.title} · paso {action.stepNumber} de {action.stepCount}
              </small>
            )}
            <h1 className="lockdown-task">{action.task.title}</h1>
          </>
        ) : (
          <h1 className="lockdown-task">No hay tareas pendientes 🎉</h1>
        )}

        <div className="lockdown-time" role="timer">
          {formatClock(focus.phase === 'idle' ? focus.preset.focusMin * 60_000 : left)}
        </div>
        <p className="lockdown-phase">
          {focus.phase === 'focus'
            ? 'Concentración'
            : focus.phase === 'break'
              ? 'Descanso'
              : 'Cuando quieras'}
          {paused && ' · en pausa'}
        </p>

        <div className="lockdown-controls">
          <FocusControls focus={focus} />
          {action && (
            <button
              className="button-ghost"
              onClick={() =>
                completeFocusTask(action.task.id).catch((err) => console.error('[lockdown]', err))
              }
            >
              ✅ Hecho
            </button>
          )}
        </div>

        {action?.nextStep && (
          <p className="lockdown-next">
            Siguiente paso: <strong>{action.nextStep.title}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
