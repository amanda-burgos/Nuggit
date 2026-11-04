import { useState } from 'react'
import { t } from '../../../../shared/i18n'
import type { DailyInput, DailyRepeat } from '../../../../shared/types'
import { toISODate } from '../../../../shared/nextAction'

export type DailyDraft = DailyInput & { title: string; repeat: DailyRepeat }

// Monday first, as people read a week.
const week = (): Array<{ day: number; letter: string; name: string }> => [
  { day: 1, letter: t('L', 'M'), name: t('Lunes', 'Monday') },
  { day: 2, letter: t('M', 'T'), name: t('Martes', 'Tuesday') },
  { day: 3, letter: t('X', 'W'), name: t('Miércoles', 'Wednesday') },
  { day: 4, letter: t('J', 'T'), name: t('Jueves', 'Thursday') },
  { day: 5, letter: t('V', 'F'), name: t('Viernes', 'Friday') },
  { day: 6, letter: t('S', 'S'), name: t('Sábado', 'Saturday') },
  { day: 0, letter: t('D', 'S'), name: t('Domingo', 'Sunday') }
]

type Kind = DailyRepeat['kind']

// Create or edit one daily: title, how it repeats, optional time and duration, streak.
export function DailyEditor({
  initial,
  saveLabel = t('Guardar', 'Save'),
  onSave,
  onCancel
}: {
  initial?: DailyDraft
  saveLabel?: string
  onSave(draft: DailyDraft): void
  onCancel(): void
}): React.JSX.Element {
  const repeat = initial?.repeat
  const [title, setTitle] = useState(initial?.title ?? '')
  const [kind, setKind] = useState<Kind>(repeat?.kind ?? 'every-day')
  const [days, setDays] = useState<number[]>(repeat?.kind === 'weekdays' ? repeat.days : [])
  const [every, setEvery] = useState(repeat?.kind === 'every-n' ? repeat.n : 2)
  const [time, setTime] = useState(initial?.time ?? '')
  const [minutes, setMinutes] = useState(initial?.estimateMin ? String(initial.estimateMin) : '')
  const [streak, setStreak] = useState(initial?.streak ?? true)

  const buildRepeat = (): DailyRepeat | null => {
    if (kind === 'every-day') return { kind: 'every-day' }
    if (kind === 'weekdays') return days.length ? { kind: 'weekdays', days } : null
    const n = Math.round(every)
    if (!(n >= 2 && n <= 365)) return null
    const start = repeat?.kind === 'every-n' ? repeat.start : toISODate(new Date())
    return { kind: 'every-n', n, start }
  }

  const built = buildRepeat()
  const canSave = Boolean(title.trim() && built)

  const toggleDay = (day: number): void =>
    setDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]))

  return (
    <form
      className="daily-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave || !built) return
        const min = Number(minutes)
        onSave({
          title: title.trim(),
          repeat: built,
          time: time || null,
          estimateMin: min > 0 ? Math.round(min) : null,
          streak
        })
      }}
    >
      <input
        className="daily-editor-title"
        value={title}
        placeholder={t('Ej: "Bañarme", "Ir al gimnasio"', 'E.g. "Shower", "Go to the gym"')}
        aria-label={t('Nombre del daily', 'Daily name')}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="daily-editor-repeat" role="radiogroup" aria-label={t('Se repite', 'Repeats')}>
        {(
          [
            ['every-day', t('Todos los días', 'Every day')],
            ['weekdays', t('Algunos días', 'Some days')],
            ['every-n', t('Cada X días', 'Every X days')]
          ] as Array<[Kind, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            className={`daily-chip${kind === value ? ' is-active' : ''}`}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === 'weekdays' && (
        <div className="daily-editor-days" role="group" aria-label={t('Días', 'Days')}>
          {week().map((w) => (
            <button
              key={w.day}
              type="button"
              title={w.name}
              aria-pressed={days.includes(w.day)}
              className={`daily-day${days.includes(w.day) ? ' is-active' : ''}`}
              onClick={() => toggleDay(w.day)}
            >
              {w.letter}
            </button>
          ))}
        </div>
      )}

      {kind === 'every-n' && (
        <label className="daily-editor-inline">
          {t('Cada', 'Every')}
          <input
            type="number"
            min={2}
            max={365}
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
          />
          {t('días, empezando', 'days, starting')}{' '}
          {repeat?.kind === 'every-n'
            ? t(
                `el ${repeat.start.split('-').reverse().join('/')}`,
                `on ${repeat.start.split('-').reverse().join('/')}`
              )
            : t('hoy', 'today')}
        </label>
      )}

      <div className="daily-editor-row">
        <label className="daily-editor-inline">
          {t('Hora', 'Time')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="daily-editor-inline">
          {t('Dura', 'Takes')}
          <input
            type="number"
            min={1}
            max={1440}
            placeholder="—"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          min
        </label>
      </div>

      <label className="daily-editor-check">
        <input type="checkbox" checked={streak} onChange={(e) => setStreak(e.target.checked)} />
        {t('Contar racha (cuántos seguidos)', 'Count streak (how many in a row)')}
      </label>

      <div className="daily-editor-buttons">
        <button type="submit" className="button-primary" disabled={!canSave}>
          {saveLabel}
        </button>
        <button type="button" className="button-ghost" onClick={onCancel}>
          {t('Cancelar', 'Cancel')}
        </button>
      </div>
    </form>
  )
}
