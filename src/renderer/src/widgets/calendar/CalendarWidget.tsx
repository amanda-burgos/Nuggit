import { useMemo, useState } from 'react'
import { itemsByDay, type DayItem } from '../../../../shared/calendar'
import { addDays } from '../../../../shared/dailies'
import { useCalendarEvents } from '../../store/useCalendarEvents'
import { useDailies } from '../../store/useDailies'
import { useTasks } from '../../store/useTasks'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import './calendar.css'
import { locale, t } from '../../../../shared/i18n'

// The calendar has no options yet.
export type CalendarConfig = Record<string, never>

const weekdays = (): string[] =>
  t('Lun Mar Mié Jue Vie Sáb Dom', 'Mon Tue Wed Thu Fri Sat Sun').split(' ')
const log = (err: unknown): void => console.error('[calendar]', err)

const parse = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const iso = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
// Monday of the week the day is in.
const mondayOf = (day: string): string => addDays(day, -((parse(day).getDay() + 6) % 7))

// "Octubre 2026".
function monthLabel(month: string): string {
  const name = parse(month).toLocaleDateString(locale(), { month: 'long' })
  return `${name[0].toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`
}

function dayLabel(day: string, today: string): string {
  if (day === today) return t('Hoy', 'Today')
  if (day === addDays(today, 1)) return t('Mañana', 'Tomorrow')
  return parse(day).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
}

function itemTitle(item: DayItem): string {
  return item.kind === 'task'
    ? item.task.title
    : item.kind === 'daily'
      ? item.daily.title
      : item.event.title
}

function timeLabel(item: DayItem): string | null {
  if (item.kind === 'daily') return item.daily.time ?? null
  if (item.kind === 'event' && !item.event.allDay) {
    return new Date(item.event.start).toLocaleTimeString(locale(), {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  return null
}

// SPEC 9.14: tasks with a date, dailies and the Mac's events, by day. Big: the month, and
// what happens on the chosen day. Small: the next seven days.
export function CalendarWidget({ size }: WidgetProps<CalendarConfig>): React.JSX.Element {
  const today = useToday()
  const { tasks } = useTasks()
  const dailies = useDailies()
  const big = size === 'full'
  const [month, setMonth] = useState(() => `${today.slice(0, 7)}-01`)
  const [selected, setSelected] = useState(today)
  const [draft, setDraft] = useState('')

  // Big: six whole weeks around the month. Small: today and the next six days.
  const from = big ? mondayOf(month) : today
  const to = addDays(from, big ? 41 : 6)
  const events = useCalendarEvents(from, to)
  const days = useMemo(
    () => itemsByDay(from, to, tasks ?? [], dailies ?? [], events),
    [from, to, tasks, dailies, events]
  )

  if (!tasks || !dailies) return <div className="calendar" />

  const moveMonth = (by: number): void => {
    const d = parse(month)
    setMonth(iso(new Date(d.getFullYear(), d.getMonth() + by, 1)))
  }

  const goToday = (): void => {
    setMonth(`${today.slice(0, 7)}-01`)
    setSelected(today)
  }

  const add = (): void => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    window.api.tasks.create({ title, dueDate: selected }).catch(log)
  }

  const chosen = days.get(selected) ?? []

  return (
    <div className={`calendar is-${size}`}>
      {big && (
        <div className="calendar-head">
          <button
            className="icon-button"
            title={t('Mes anterior', 'Previous month')}
            onClick={() => moveMonth(-1)}
          >
            ‹
          </button>
          <h3>{monthLabel(month)}</h3>
          <button
            className="icon-button"
            title={t('Mes siguiente', 'Next month')}
            onClick={() => moveMonth(1)}
          >
            ›
          </button>
          <button className="button-ghost" onClick={goToday}>
            {t('Hoy', 'Today')}
          </button>
        </div>
      )}

      <div className="calendar-body">
        <div className={big ? 'calendar-grid' : 'calendar-strip'} role="grid">
          {big &&
            weekdays().map((w) => (
              <span key={w} className="calendar-weekday" aria-hidden>
                {w}
              </span>
            ))}
          {[...days.entries()].map(([day, items]) => {
            const outside = big && day.slice(0, 7) !== month.slice(0, 7)
            return (
              <button
                key={day}
                role="gridcell"
                aria-selected={day === selected}
                aria-label={t(
                  `${dayLabel(day, today)}: ${items.length} cosas`,
                  `${dayLabel(day, today)}: ${items.length} items`
                )}
                className={[
                  'calendar-day',
                  day === today ? 'is-today' : '',
                  day === selected ? 'is-selected' : '',
                  outside ? 'is-outside' : ''
                ].join(' ')}
                onClick={() => setSelected(day)}
              >
                <span className="calendar-date">
                  {!big && <small>{weekdays()[(parse(day).getDay() + 6) % 7]}</small>}
                  <span className="calendar-number">{parse(day).getDate()}</span>
                  {big && day === today && (
                    <span className="calendar-today-tag">{t('Hoy', 'Today')}</span>
                  )}
                </span>
                {big ? (
                  <span className="calendar-chips">
                    {items.slice(0, 3).map((item, i) => (
                      <span key={i} className={`calendar-chip is-${item.kind}`}>
                        {itemTitle(item)}
                      </span>
                    ))}
                    {items.length > 3 && <small>+{items.length - 3}</small>}
                  </span>
                ) : (
                  <span className="calendar-dots" aria-hidden>
                    {items.slice(0, 4).map((item, i) => (
                      <i key={i} className={`is-${item.kind}`} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <section className="calendar-agenda" aria-label={dayLabel(selected, today)}>
          <h4>{dayLabel(selected, today)}</h4>
          {chosen.length === 0 ? (
            <p className="calendar-hint">{t('Nada este día 🌤️', 'Nothing this day 🌤️')}</p>
          ) : (
            <ul>
              {chosen.map((item, i) => (
                <AgendaItem key={i} item={item} today={today} />
              ))}
            </ul>
          )}
          <form
            className="calendar-add"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input
              value={draft}
              placeholder={t('Anotar una tarea para este día…', 'Add a task for this day…')}
              aria-label={t('Nueva tarea para este día', 'New task for this day')}
              onChange={(e) => setDraft(e.target.value)}
            />
          </form>
        </section>
      </div>
    </div>
  )
}

function AgendaItem({ item, today }: { item: DayItem; today: string }): React.JSX.Element {
  const time = timeLabel(item)
  if (item.kind === 'event') {
    return (
      <li className="calendar-item is-event">
        <span className="calendar-icon" aria-hidden>
          🗓
        </span>
        <span className="calendar-item-main">
          {item.event.title || t('(sin título)', '(untitled)')}
          <small>{[time ?? t('Todo el día', 'All day'), item.event.calendar].join(' · ')}</small>
        </span>
      </li>
    )
  }
  if (item.kind === 'daily') {
    return (
      <li className={`calendar-item is-daily${item.done ? ' is-done' : ''}`}>
        <span className="calendar-icon" aria-hidden>
          🔁
        </span>
        <span className="calendar-item-main">
          {item.daily.title}
          <small>
            {[time, item.done ? t('hecho', 'done') : null].filter(Boolean).join(' · ') || 'Daily'}
          </small>
        </span>
      </li>
    )
  }
  const { task } = item
  const done = task.status === 'done'
  return (
    <li className={`calendar-item is-task${done ? ' is-done' : ''}`}>
      <button
        className="calendar-check"
        role="checkbox"
        aria-checked={done}
        aria-label={`${task.title}: ${done ? t('hecha', 'done') : t('pendiente', 'to do')}`}
        onClick={() =>
          (done
            ? window.api.tasks.update(task.id, { status: 'todo' })
            : window.api.tasks.complete(task.id)
          ).catch(log)
        }
      >
        {done ? '✓' : ''}
      </button>
      <span className="calendar-item-main">
        {task.title}
        <small>
          {task.dueDate && task.dueDate < today && !done
            ? t('Era para antes', 'Overdue')
            : t('Tarea', 'Task')}
        </small>
      </span>
    </li>
  )
}
