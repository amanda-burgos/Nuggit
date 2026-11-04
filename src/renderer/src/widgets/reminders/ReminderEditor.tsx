import { useState } from 'react'
import type { ReminderInput, ReminderRepeat } from '../../../../shared/types'
import { addDays } from '../../../../shared/dailies'
import { localKey } from '../../../../shared/reminders'
import '../dailies/dailies.css'
import { t } from '../../../../shared/i18n'

export type ReminderDraft = ReminderInput & {
  title: string
  date: string
  time: string
  repeat: ReminderRepeat
}

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

type Kind = ReminderRepeat['kind']

const kinds = (): Array<[Kind, string]> => [
  ['once', t('Una vez', 'Once')],
  ['every-day', t('Todos los días', 'Every day')],
  ['weekdays', t('Algunos días', 'Some days')],
  ['every-n', t('Cada X días', 'Every X days')]
]

// "En 15 min", "En 1 hora", "Mañana 9:00": a day and time in one tap.
function quickTimes(now: Date): Array<{ label: string; key: string }> {
  const today = localKey(now).slice(0, 10)
  return [
    { label: t('En 15 min', 'In 15 min'), key: localKey(new Date(now.getTime() + 15 * 60_000)) },
    { label: t('En 1 hora', 'In 1 hour'), key: localKey(new Date(now.getTime() + 60 * 60_000)) },
    { label: t('Mañana 9:00', 'Tomorrow 9:00'), key: `${addDays(today, 1)}T09:00` }
  ]
}

// Create or edit one reminder: what, which day and time, and if it repeats.
export function ReminderEditor({
  initial,
  compact = false,
  saveLabel = t('Guardar', 'Save'),
  onSave,
  onCancel
}: {
  initial?: ReminderDraft
  compact?: boolean // the small widget: no repeat options
  saveLabel?: string
  onSave(draft: ReminderDraft): void
  onCancel?: () => void
}): React.JSX.Element {
  const now = new Date()
  const nowKey = localKey(now)
  const repeat = initial?.repeat
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? nowKey.slice(0, 10))
  const [time, setTime] = useState(initial?.time ?? '')
  const [kind, setKind] = useState<Kind>(repeat?.kind ?? 'once')
  const [days, setDays] = useState<number[]>(repeat?.kind === 'weekdays' ? repeat.days : [])
  const [every, setEvery] = useState(repeat?.kind === 'every-n' ? repeat.n : 2)

  const buildRepeat = (): ReminderRepeat | null => {
    if (kind === 'once' || kind === 'every-day') return { kind }
    if (kind === 'weekdays') return days.length ? { kind: 'weekdays', days } : null
    const n = Math.round(every)
    return n >= 2 && n <= 365 ? { kind: 'every-n', n, start: date } : null
  }

  const built = buildRepeat()
  // A one-time reminder for a time that already passed would never ring.
  const past = kind === 'once' && Boolean(date && time) && `${date}T${time}` < nowKey
  const canSave = Boolean(title.trim() && date && time && built && !past)

  const toggleDay = (day: number): void =>
    setDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]))

  const reset = (): void => {
    setTitle('')
    setTime('')
  }

  return (
    <form
      className={`reminder-editor${compact ? ' is-compact' : ''}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave || !built) return
        onSave({ title: title.trim(), date, time, repeat: built })
        if (!initial) reset()
      }}
    >
      <input
        className="reminder-editor-title"
        value={title}
        maxLength={200}
        placeholder={t(
          'Ej: "Tomar la pastilla", "Sacar la ropa"',
          'E.g. "Take my pill", "Get the laundry out"'
        )}
        aria-label={t('Qué te recuerdo', 'What should I remind you of')}
        autoFocus={!compact}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="reminder-editor-row">
        <input
          type="date"
          value={date}
          aria-label={t('Día', 'Day')}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          value={time}
          aria-label={t('Hora', 'Time')}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>

      <div className="reminder-quick" role="group" aria-label={t('Rápido', 'Quick')}>
        {quickTimes(now).map((q) => (
          <button
            key={q.label}
            type="button"
            className="daily-chip"
            onClick={() => {
              setDate(q.key.slice(0, 10))
              setTime(q.key.slice(11))
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {!compact && (
        <>
          <div
            className="daily-editor-repeat"
            role="radiogroup"
            aria-label={t('Se repite', 'Repeats')}
          >
            {kinds().map(([value, label]) => (
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
              {t('días, empezando ese día', 'days, starting that day')}
            </label>
          )}
        </>
      )}

      {past && (
        <p className="reminder-hint">
          {t('Esa hora ya pasó. Escoge otra.', 'That time already passed. Pick another one.')}
        </p>
      )}

      <div className="daily-editor-buttons">
        <button type="submit" className="button-primary" disabled={!canSave}>
          {saveLabel}
        </button>
        {onCancel && (
          <button type="button" className="button-ghost" onClick={onCancel}>
            {t('Cancelar', 'Cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
