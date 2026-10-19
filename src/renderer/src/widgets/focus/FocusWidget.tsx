import { useState } from 'react'
import type { FocusPreset, FocusState } from '../../../../shared/types'
import { formatClock, useFocus, useTimeLeft } from '../../store/useFocus'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import { completeFocusTask, useFocusTask } from './useFocusTask'
import './focus.css'

// Focus has no options yet: the chosen times are kept with the timer itself.
export type FocusConfig = Record<string, never>

const PRESETS: FocusPreset[] = [
  { focusMin: 25, breakMin: 5 },
  { focusMin: 15, breakMin: 5 }
]

const PHASE_LABELS = { idle: 'Listo para empezar', focus: 'Concentración', break: 'Descanso' }

const same = (a: FocusPreset, b: FocusPreset): boolean =>
  a.focusMin === b.focusMin && a.breakMin === b.breakMin

const log = (err: unknown): void => console.error('[focus]', err)

// SPEC 9.8: a timer (25/5, 15/5 or your own) with the task you're on. Pause, cancel and
// change the times at any moment. From here you go into Lockdown (9.9).
export function FocusWidget({ size }: WidgetProps<FocusConfig>): React.JSX.Element {
  const focus = useFocus()
  const left = useTimeLeft(focus)
  const { action, pending } = useFocusTask(focus)
  const today = useToday()
  const [custom, setCustom] = useState(false)

  if (!focus) return <div className="focus" />

  const paused = focus.pausedLeftMs !== null
  const progress = focus.phase === 'idle' || !focus.durationMs ? 0 : 1 - left / focus.durationMs
  const isPreset = PRESETS.some((p) => same(p, focus.preset))
  const rounds = focus.roundsDay === today ? focus.rounds : 0

  return (
    <div className={`focus is-${size} is-${focus.phase}`}>
      <div className="focus-task">
        <small>{focus.phase === 'break' ? 'Después del descanso' : 'Ahora'}</small>
        {action ? (
          <>
            <strong>{action.task.title}</strong>
            {action.task !== action.root && (
              <small>
                Paso {action.stepNumber} de {action.stepCount} · {action.root.title}
              </small>
            )}
          </>
        ) : (
          <strong className="focus-muted">No hay tareas pendientes 🎉</strong>
        )}
        {pending.length > 0 && (
          <select
            aria-label="Tarea"
            value={
              focus.taskId && pending.some((p) => p.task.id === focus.taskId) ? focus.taskId : ''
            }
            onChange={(e) => window.api.focus.setTask(e.target.value || null).catch(log)}
          >
            <option value="">Lo que diga “¿Qué hago ahora?”</option>
            {pending.map((p) => (
              <option key={p.task.id} value={p.task.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="focus-clock" role="timer" aria-live="off">
        <span className="focus-phase">
          {PHASE_LABELS[focus.phase]}
          {paused && ' · en pausa'}
        </span>
        <span className="focus-time">
          {formatClock(focus.phase === 'idle' ? focus.preset.focusMin * 60_000 : left)}
        </span>
        <div className="focus-bar" aria-hidden>
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <FocusControls focus={focus} />

      <div className="focus-presets" role="group" aria-label="Tiempos">
        {PRESETS.map((p) => (
          <button
            key={p.focusMin}
            className={`focus-chip${same(p, focus.preset) && !custom ? ' is-active' : ''}`}
            onClick={() => {
              setCustom(false)
              window.api.focus.setPreset(p).catch(log)
            }}
          >
            {p.focusMin}/{p.breakMin}
          </button>
        ))}
        <button
          className={`focus-chip${custom || !isPreset ? ' is-active' : ''}`}
          onClick={() => setCustom(true)}
        >
          Personalizado
        </button>
      </div>
      {(custom || !isPreset) && (
        <CustomTimes key={JSON.stringify(focus.preset)} preset={focus.preset} />
      )}

      <div className="focus-footer">
        {action && (
          <button
            className="button-ghost"
            onClick={() => completeFocusTask(action.task.id).catch(log)}
          >
            ✅ Hecho
          </button>
        )}
        <button
          className="button-ghost"
          title="Pantalla de concentración"
          onClick={() => window.api.focus.setLockdown(true).catch(log)}
        >
          🔒 Lockdown
        </button>
        {rounds > 0 && <small className="focus-muted">✓ {rounds} hoy</small>}
      </div>
    </div>
  )
}

export function FocusControls({ focus }: { focus: FocusState }): React.JSX.Element {
  const paused = focus.pausedLeftMs !== null
  if (focus.phase === 'idle') {
    return (
      <div className="focus-controls">
        <button className="button-primary" onClick={() => window.api.focus.start().catch(log)}>
          ▶ Empezar
        </button>
      </div>
    )
  }
  return (
    <div className="focus-controls">
      {paused ? (
        <button className="button-primary" onClick={() => window.api.focus.resume().catch(log)}>
          ▶ Seguir
        </button>
      ) : (
        <button className="button-primary" onClick={() => window.api.focus.pause().catch(log)}>
          ⏸ Pausa
        </button>
      )}
      <button className="button-ghost" onClick={() => window.api.focus.cancel().catch(log)}>
        {focus.phase === 'break' ? 'Saltar descanso' : 'Cancelar'}
      </button>
    </div>
  )
}

function CustomTimes({ preset }: { preset: FocusPreset }): React.JSX.Element {
  const [draft, setDraft] = useState({
    focusMin: String(preset.focusMin),
    breakMin: String(preset.breakMin)
  })
  const save = (): void => {
    const next = { focusMin: Number(draft.focusMin), breakMin: Number(draft.breakMin) }
    if (next.focusMin >= 1 && next.breakMin >= 1 && !same(next, preset)) {
      window.api.focus.setPreset(next).catch(log)
    }
  }
  return (
    <div className="focus-custom">
      {(['focusMin', 'breakMin'] as const).map((key) => (
        <label key={key}>
          <input
            type="number"
            min={1}
            max={180}
            value={draft[key]}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
          <span>{key === 'focusMin' ? 'min de concentración' : 'min de descanso'}</span>
        </label>
      ))}
    </div>
  )
}
