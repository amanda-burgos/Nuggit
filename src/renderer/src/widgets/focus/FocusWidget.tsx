import { useState } from 'react'
import type { FocusPreset, FocusState } from '../../../../shared/types'
import { formatClock, useFocus, useTimeLeft } from '../../store/useFocus'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import { MusicControls } from './MusicControls'
import { completeFocusTask, useFocusTask } from './useFocusTask'
import './focus.css'
import { t } from '../../../../shared/i18n'

// Focus has no options yet: the chosen times are kept with the timer itself.
export type FocusConfig = Record<string, never>

const PRESETS: FocusPreset[] = [
  { focusMin: 25, breakMin: 5 },
  { focusMin: 15, breakMin: 5 }
]

const phaseLabels = (): Record<FocusState['phase'], string> => ({
  idle: t('Listo para empezar', 'Ready to start'),
  focus: t('Concentración', 'Focusing'),
  break: t('Descanso', 'Break')
})

const same = (a: FocusPreset, b: FocusPreset): boolean =>
  a.focusMin === b.focusMin && a.breakMin === b.breakMin

const log = (err: unknown): void => console.error('[focus]', err)

// SPEC 9.8: a timer (25/5, 15/5 or your own) with the task you're on. Pause, cancel and
// change the times at any moment.
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
        <small>
          {focus.phase === 'break'
            ? t('Después del descanso', 'After the break')
            : t('Ahora', 'Now')}
        </small>
        {action ? (
          <>
            <strong>{action.task.title}</strong>
            {action.task !== action.root && (
              <small>
                {t(
                  `Paso ${action.stepNumber} de ${action.stepCount}`,
                  `Step ${action.stepNumber} of ${action.stepCount}`
                )}{' '}
                · {action.root.title}
              </small>
            )}
          </>
        ) : (
          <strong className="focus-muted">
            {t('No hay tareas pendientes 🎉', 'No pending tasks 🎉')}
          </strong>
        )}
        {pending.length > 0 && (
          <select
            aria-label={t('Tarea', 'Task')}
            value={
              focus.taskId && pending.some((p) => p.task.id === focus.taskId) ? focus.taskId : ''
            }
            onChange={(e) => window.api.focus.setTask(e.target.value || null).catch(log)}
          >
            <option value="">
              {t('Lo que diga “¿Qué hago ahora?”', 'Whatever “What do I do now?” says')}
            </option>
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
          {phaseLabels()[focus.phase]}
          {paused && t(' · en pausa', ' · paused')}
        </span>
        <span className="focus-time">
          {formatClock(focus.phase === 'idle' ? focus.preset.focusMin * 60_000 : left)}
        </span>
        <div className="focus-bar" aria-hidden>
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <FocusControls focus={focus} />
      <MusicControls />

      <div className="focus-presets" role="group" aria-label={t('Tiempos', 'Times')}>
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
          {t('Personalizado', 'Custom')}
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
            {t('✅ Hecho', '✅ Done')}
          </button>
        )}
        {rounds > 0 && (
          <small className="focus-muted">{t(`✓ ${rounds} hoy`, `✓ ${rounds} today`)}</small>
        )}
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
          {t('▶ Empezar', '▶ Start')}
        </button>
      </div>
    )
  }
  return (
    <div className="focus-controls">
      {paused ? (
        <button className="button-primary" onClick={() => window.api.focus.resume().catch(log)}>
          {t('▶ Seguir', '▶ Resume')}
        </button>
      ) : (
        <button className="button-primary" onClick={() => window.api.focus.pause().catch(log)}>
          {t('⏸ Pausa', '⏸ Pause')}
        </button>
      )}
      <button className="button-ghost" onClick={() => window.api.focus.cancel().catch(log)}>
        {focus.phase === 'break' ? t('Saltar descanso', 'Skip break') : t('Cancelar', 'Cancel')}
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
          <span>
            {key === 'focusMin'
              ? t('min de concentración', 'min of focus')
              : t('min de descanso', 'min of break')}
          </span>
        </label>
      ))}
    </div>
  )
}
