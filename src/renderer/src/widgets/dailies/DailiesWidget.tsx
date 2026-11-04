import { useEffect, useMemo, useState } from 'react'
import { t } from '../../../../shared/i18n'
import type { Daily, Task } from '../../../../shared/types'
import { describeRepeat, isDueOn, streakOf } from '../../../../shared/dailies'
import { useAIStatus } from '../../store/useAIStatus'
import { useDailies } from '../../store/useDailies'
import { useTasks } from '../../store/useTasks'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import { DailyEditor } from './DailyEditor'
import { DailyPlanner } from './DailyPlanner'
import './dailies.css'

// Dailies have no options yet.
export type DailiesConfig = Record<string, never>

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string } | { kind: 'plan' }

const UNDO_MS = 8000

// SPEC 9.13: things that repeat. "Hoy" ticks off today's (they are real tasks, so they
// also show in Tareas and Next Action); below, every daily to add, change or remove.
export function DailiesWidget({ size }: WidgetProps<DailiesConfig>): React.JSX.Element {
  const dailies = useDailies()
  const { tasks } = useTasks()
  const today = useToday()
  const aiStatus = useAIStatus()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [showAll, setShowAll] = useState(size !== 'widget')
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null)

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  // Today's tasks made from dailies, in the order of their time (no time last).
  const todays = useMemo(() => {
    const byId = new Map((dailies ?? []).map((d) => [d.id, d]))
    return (tasks ?? [])
      .filter((t) => t.dailyId && t.dueDate === today && byId.has(t.dailyId))
      .map((task) => ({ task, daily: byId.get(task.dailyId!)! }))
      .sort(
        (a, b) =>
          (a.daily.time ?? '99').localeCompare(b.daily.time ?? '99') ||
          a.daily.order - b.daily.order
      )
  }, [tasks, dailies, today])

  if (!dailies || !tasks) return <div className="dailies" />

  const toggle = (task: Task): void => {
    const call =
      task.status === 'done'
        ? window.api.tasks.update(task.id, { status: 'todo' })
        : window.api.tasks.complete(task.id)
    call.catch((err) => console.error('Could not tick daily', err))
  }

  const remove = (daily: Daily): void => {
    if (
      !window.confirm(
        t(
          `¿Borrar el daily "${daily.title}"? Deja de repetirse.`,
          `Delete the daily "${daily.title}"? It will stop repeating.`
        )
      )
    )
      return
    window.api.dailies.remove([daily.id]).catch((err) => console.error(err))
  }

  if (mode.kind === 'plan') {
    return (
      <div className={`dailies is-${size}`}>
        <DailyPlanner
          onClose={() => setMode({ kind: 'list' })}
          onDone={(saved) => {
            setMode({ kind: 'list' })
            if (saved.length) {
              setUndo({
                ids: saved.map((d) => d.id),
                label:
                  saved.length === 1
                    ? t('1 daily guardado ✓', '1 daily saved ✓')
                    : t(`${saved.length} dailies guardados ✓`, `${saved.length} dailies saved ✓`)
              })
            }
          }}
        />
      </div>
    )
  }

  const editing = mode.kind === 'edit' ? dailies.find((d) => d.id === mode.id) : undefined
  const doneToday = todays.filter((t) => t.task.status === 'done').length

  return (
    <div className={`dailies is-${size}`}>
      <section className="dailies-today" aria-label={t('Hoy', 'Today')}>
        <h3>
          {t('Hoy', 'Today')}
          {todays.length > 0 && (
            <span className="dailies-count">
              {t(`${doneToday} de ${todays.length}`, `${doneToday} of ${todays.length}`)}
            </span>
          )}
        </h3>
        {todays.length === 0 ? (
          <p className="daily-hint">
            {dailies.length === 0
              ? t(
                  'Todavía no tienes dailies. Agrega lo que repites (bañarte, gimnasio, tarea…).',
                  'No dailies yet. Add the things you repeat (shower, gym, homework…).'
                )
              : t('Hoy no toca ningún daily 🌤️', 'No dailies today 🌤️')}
          </p>
        ) : (
          <ul className="daily-list">
            {todays.map(({ task, daily }) => {
              const streak = daily.streak ? streakOf(daily, today) : 0
              const done = task.status === 'done'
              return (
                <li key={task.id} className={`daily-row${done ? ' is-done' : ''}`}>
                  <button
                    className="daily-check"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`${daily.title}: ${done ? t('hecho', 'done') : t('pendiente', 'not done')}`}
                    onClick={() => toggle(task)}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <span className="daily-row-main">
                    <span className="daily-title">{task.title}</span>
                    <small>
                      {[daily.time, daily.estimateMin ? `${daily.estimateMin} min` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  {/* Only good news: a streak shows from 2 in a row, and simply goes away. */}
                  {streak >= 2 && (
                    <span className="daily-streak" title={t('Veces seguidas', 'Times in a row')}>
                      🔥 {streak}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {mode.kind === 'new' && (
        <DailyEditor
          onSave={(draft) => {
            window.api.dailies.create(draft).catch((err) => console.error(err))
            setMode({ kind: 'list' })
          }}
          onCancel={() => setMode({ kind: 'list' })}
        />
      )}

      {mode.kind === 'list' && (
        <div className="dailies-actions">
          <button className="button-primary" onClick={() => setMode({ kind: 'new' })}>
            {t('+ Nuevo daily', '+ New daily')}
          </button>
          <button
            className="button-ghost"
            disabled={!aiStatus?.active}
            title={
              aiStatus?.active
                ? t('Dip te ayuda a armar tu rutina', 'Dip helps you build your routine')
                : t('Conecta una IA en Ajustes', 'Connect an AI in Settings')
            }
            onClick={() => setMode({ kind: 'plan' })}
          >
            {t('✨ Planear con Dip', '✨ Plan with Dip')}
          </button>
        </div>
      )}

      {dailies.length > 0 && (
        <section className="dailies-all" aria-label={t('Todos los dailies', 'All dailies')}>
          <button
            className="dailies-all-toggle"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? '▾' : '▸'} {t('Todos', 'All')} ({dailies.length})
          </button>
          {showAll && (
            <ul className="daily-list">
              {[...dailies]
                .sort((a, b) => a.order - b.order)
                .map((d) =>
                  editing?.id === d.id ? (
                    <li key={d.id}>
                      <DailyEditor
                        initial={d}
                        onSave={(draft) => {
                          window.api.dailies.update(d.id, draft).catch((err) => console.error(err))
                          setMode({ kind: 'list' })
                        }}
                        onCancel={() => setMode({ kind: 'list' })}
                      />
                    </li>
                  ) : (
                    <li key={d.id} className="daily-row">
                      <span className="daily-row-main">
                        <span className="daily-title">{d.title}</span>
                        <small>
                          {describeRepeat(d.repeat)}
                          {d.time ? ` · ${d.time}` : ''}
                          {isDueOn(d.repeat, today) ? t(' · toca hoy', ' · due today') : ''}
                        </small>
                      </span>
                      <button
                        className="icon-button"
                        title={t('Editar', 'Edit')}
                        onClick={() => setMode({ kind: 'edit', id: d.id })}
                      >
                        ✏️
                      </button>
                      <button
                        className="icon-button"
                        title={t('Borrar', 'Delete')}
                        onClick={() => remove(d)}
                      >
                        ×
                      </button>
                    </li>
                  )
                )}
            </ul>
          )}
        </section>
      )}

      {undo && (
        <div className="dailies-undo" role="status">
          <span>{undo.label}</span>
          <button
            className="button-ghost"
            onClick={() => {
              window.api.dailies.remove(undo.ids).catch((err) => console.error(err))
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
