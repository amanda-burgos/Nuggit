import { describe, expect, it } from 'vitest'
import { describeWhen, keyToDate, localKey, nextOccurrence, nextRing } from './reminders'
import type { Reminder } from './types'

const base: Reminder = {
  id: 'r1',
  title: 'Tomar agua',
  date: '2026-11-02', // a Monday
  time: '09:00',
  repeat: { kind: 'once' },
  after: '2026-11-02T08:00',
  createdAt: '',
  updatedAt: ''
}

describe('nextOccurrence', () => {
  it('rings a one-time reminder once', () => {
    expect(nextOccurrence(base)).toBe('2026-11-02T09:00')
    expect(nextOccurrence({ ...base, after: '2026-11-02T09:00' })).toBeNull()
  })

  it('moves a daily one to the next day after it rang', () => {
    const daily = { ...base, repeat: { kind: 'every-day' as const } }
    expect(nextOccurrence(daily)).toBe('2026-11-02T09:00')
    expect(nextOccurrence({ ...daily, after: '2026-11-02T09:00' })).toBe('2026-11-03T09:00')
  })

  it('skips the days it does not repeat on', () => {
    const r = {
      ...base,
      repeat: { kind: 'weekdays' as const, days: [3] },
      after: '2026-11-02T10:00'
    }
    expect(nextOccurrence(r)).toBe('2026-11-04T09:00') // Wednesday
  })

  it('never rings before its first day', () => {
    const r = { ...base, date: '2026-11-10', repeat: { kind: 'every-day' as const } }
    expect(nextOccurrence(r)).toBe('2026-11-10T09:00')
  })

  it('counts "every n days" from its first day', () => {
    const r = {
      ...base,
      repeat: { kind: 'every-n' as const, n: 3, start: '2026-11-02' },
      after: '2026-11-02T09:00'
    }
    expect(nextOccurrence(r)).toBe('2026-11-05T09:00')
  })
})

describe('nextRing', () => {
  it('uses "Posponer" when it comes first', () => {
    const snoozeUntil = keyToDate('2026-11-02T08:30').toISOString()
    expect(nextRing({ ...base, snoozeUntil })?.toISOString()).toBe(snoozeUntil)
    const done = { ...base, after: '2026-11-02T09:00', snoozeUntil }
    expect(nextRing(done)?.toISOString()).toBe(snoozeUntil)
  })
})

describe('describeWhen', () => {
  const now = keyToDate('2026-11-02T08:00')
  it('says today, tomorrow, a weekday or the date', () => {
    expect(describeWhen(keyToDate('2026-11-02T09:05'), now)).toBe('Hoy 9:05')
    expect(describeWhen(keyToDate('2026-11-03T18:30'), now)).toBe('Mañana 18:30')
    expect(describeWhen(keyToDate('2026-11-05T07:00'), now)).toBe('El jueves 7:00')
    expect(describeWhen(keyToDate('2026-11-20T09:00'), now)).toBe('20 nov 9:00')
  })

  it('round-trips local keys', () => {
    expect(localKey(keyToDate('2026-03-08T02:30'))).toMatch(/^2026-03-08T0[23]:30$/)
  })
})
