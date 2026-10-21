import { describe, expect, it } from 'vitest'
import { buildIcs, calendarEntries, itemsByDay, repeatRule } from './calendar'
import type { CalendarEvent, Daily, Task } from './types'

const task = (id: string, title: string, extra: Partial<Task> = {}): Task =>
  ({ id, title, status: 'todo', priority: 'medium', order: 0, ...extra }) as Task

const daily = (id: string, title: string, extra: Partial<Daily> = {}): Daily =>
  ({
    id,
    title,
    repeat: { kind: 'every-day' },
    streak: true,
    done: [],
    order: 0,
    createdAt: '2026-10-19T08:00:00',
    updatedAt: '2026-10-19T08:00:00',
    ...extra
  }) as Daily

describe('calendar days', () => {
  it('puts tasks, dailies (from the day they were made) and events on their days', () => {
    const tasks = [
      task('t1', 'Inglés', { dueDate: '2026-10-20' }),
      task('t2', 'Sin fecha'),
      task('t3', 'Copia del daily', { dueDate: '2026-10-20', dailyId: 'd1' })
    ]
    const dailies = [
      daily('d1', 'Gimnasio', {
        repeat: { kind: 'weekdays', days: [1, 3] },
        time: '07:00',
        done: ['2026-10-19']
      })
    ]
    const events: CalendarEvent[] = [
      {
        id: 'e1',
        title: 'Viaje',
        start: new Date(2026, 9, 20).toISOString(),
        end: new Date(2026, 9, 22).toISOString(),
        allDay: true,
        calendar: 'Casa'
      }
    ]
    const days = itemsByDay('2026-10-18', '2026-10-22', tasks, dailies, events)
    const titles = (day: string): string[] =>
      days
        .get(day)!
        .map((i) =>
          i.kind === 'task' ? i.task.title : i.kind === 'daily' ? i.daily.title : i.event.title
        )
    expect(titles('2026-10-18')).toEqual([]) // Sunday, and before the daily existed
    expect(days.get('2026-10-19')).toEqual([{ kind: 'daily', daily: dailies[0], done: true }])
    expect(titles('2026-10-20')).toEqual(['Viaje', 'Inglés'])
    expect(titles('2026-10-21')).toEqual(['Viaje', 'Gimnasio'])
    expect(titles('2026-10-22')).toEqual([]) // the all-day event ended the day before
  })
})

describe('entries for the Mac calendar and .ics', () => {
  it('turns repeats into calendar rules', () => {
    expect(repeatRule({ kind: 'every-day' })).toBe('FREQ=DAILY')
    expect(repeatRule({ kind: 'weekdays', days: [3, 1] })).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(repeatRule({ kind: 'every-n', n: 3, start: '2026-10-01' })).toBe('FREQ=DAILY;INTERVAL=3')
  })

  it('keeps pending dated tasks and every daily, starting on its first due day', () => {
    const entries = calendarEntries(
      [
        task('t1', 'Inglés', { dueDate: '2026-10-20' }),
        task('t2', 'Hecha', { dueDate: '2026-10-20', status: 'done' }),
        task('t3', 'Copia', { dueDate: '2026-10-20', dailyId: 'd1' })
      ],
      // Made on a Monday, due Wednesdays: starts on Wednesday the 21st.
      [daily('d1', 'Gimnasio', { repeat: { kind: 'weekdays', days: [3] }, time: '07:00' })]
    )
    expect(entries.map((e) => [e.key, e.date, e.time ?? null])).toEqual([
      ['task:t1', '2026-10-20', null],
      ['daily:d1', '2026-10-21', '07:00']
    ])
  })

  it('writes a valid .ics', () => {
    const ics = buildIcs(
      calendarEntries(
        [task('t1', 'Inglés, unidad 3; leer', { dueDate: '2026-10-20' })],
        [daily('d1', 'Gimnasio', { time: '23:30', estimateMin: 60 })]
      ),
      new Date('2026-10-21T12:00:00Z')
    )
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain(String.raw`SUMMARY:Inglés\, unidad 3\; leer`)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261021')
    // An hour from 23:30 ends after midnight, on the next day.
    expect(ics).toContain('DTSTART:20261019T233000\r\nDTEND:20261020T003000\r\nRRULE:FREQ=DAILY')
    expect(ics).toContain('UID:task-t1@nuggit.app')
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true
    )
  })
})
