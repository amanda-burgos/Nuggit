import { t } from './i18n'
import type { Daily, DailyRepeat } from './types'

// SPEC 9.13: when a daily is due, and how many times in a row it was done. Shared by the
// main process (which makes today's tasks) and the Dailies widget.

const DAY_MS = 86_400_000
const weekdayShort = (): string[] =>
  t('Dom,Lun,Mar,Mié,Jue,Vie,Sáb', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat').split(',')
const weekdayLong = (): string[] =>
  t(
    'domingos,lunes,martes,miércoles,jueves,viernes,sábados',
    'Sundays,Mondays,Tuesdays,Wednesdays,Thursdays,Fridays,Saturdays'
  ).split(',')

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

// Whole days from a to b (b - a), safe across daylight saving changes.
function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS)
}

export function isDueOn(repeat: DailyRepeat, date: string): boolean {
  if (repeat.kind === 'every-day') return true
  if (repeat.kind === 'weekdays') return repeat.days.includes(parseDate(date).getDay())
  const diff = daysBetween(repeat.start, date)
  return diff >= 0 && diff % repeat.n === 0
}

// Times in a row, counting only the days it was due. Today still counts as "not yet" until
// the day is over, so an undone daily in the morning doesn't break the streak.
export function streakOf(daily: Pick<Daily, 'repeat' | 'done'>, today: string): number {
  const done = new Set(daily.done)
  let count = 0
  let day = today
  if (isDueOn(daily.repeat, day) && !done.has(day)) day = addDays(day, -1)
  for (let i = 0; i < 400; i++, day = addDays(day, -1)) {
    if (!isDueOn(daily.repeat, day)) continue
    if (!done.has(day)) break
    count++
  }
  return count
}

// "Todos los días", "Lun, Mié y Vie", "De lunes a viernes", "Cada 3 días"…
export function describeRepeat(repeat: DailyRepeat): string {
  if (repeat.kind === 'every-day') return t('Todos los días', 'Every day')
  if (repeat.kind === 'every-n')
    return repeat.n === 2
      ? t('Un día sí y otro no', 'Every other day')
      : t(`Cada ${repeat.n} días`, `Every ${repeat.n} days`)
  const days = [...repeat.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday first
  if (days.length === 7) return t('Todos los días', 'Every day')
  if (days.join() === '1,2,3,4,5') return t('De lunes a viernes', 'Monday to Friday')
  if (days.join() === '6,0') return t('Fines de semana', 'Weekends')
  if (days.length === 1) return t(`Los ${weekdayLong()[days[0]]}`, weekdayLong()[days[0]])
  const short = weekdayShort()
  const names = days.map((d) => short[d])
  return `${names.slice(0, -1).join(', ')} ${t('y', 'and')} ${names[names.length - 1]}`
}
