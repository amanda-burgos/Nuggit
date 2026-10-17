import type { DipAction, Task } from '../../shared/types'
import { isoDate } from './agents/types'

// Finding the task Dip (or the user) means by its name, and the day the user said, here on
// this computer: Dip names tasks by title, and small models are bad at calendar maths.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FILLER = new Set([
  'la',
  'el',
  'de',
  'del',
  'los',
  'las',
  'mi',
  'tarea',
  'un',
  'una',
  'y',
  'a'
])

function scoreTask(target: string, task: Task): number {
  const words = target.split(' ').filter((w) => w.length > 2 && !FILLER.has(w))
  const title = normalize(task.title)
  if (title === target) return 100
  if (title.includes(target) || target.includes(title)) return 60
  const titleWords = new Set(title.split(' '))
  const shared = words.filter((w) => titleWords.has(w)).length
  return shared ? 20 + (20 * shared) / Math.max(words.length, 1) : 0
}

// The pending task whose title best matches the name (exact > contains > shared words).
export function findTask(name: string, tasks: Task[]): Task | undefined {
  const target = normalize(name)
  if (!target) return undefined
  let best: { task: Task; score: number } | undefined
  for (const task of tasks) {
    if (task.status === 'done') continue
    let score = scoreTask(target, task)
    if (score && task.status === 'doing') score += 5
    if (score && (!best || score > best.score)) best = { task, score }
  }
  return best?.task
}

// Small models pick the wrong task sometimes: if the user's own words clearly name a task
// ("ya terminé mate"), that one wins over Dip's guess.
export function pickTask(dipName: string, userText: string, tasks: Task[]): Task | undefined {
  const fromUser = findTask(userText, tasks)
  if (fromUser && scoreTask(normalize(userText), fromUser) >= 30) return fromUser
  return dipName ? findTask(dipName, tasks) : fromUser
}

// "hoy", "mañana", "pasado mañana" or a weekday in the user's words, worked out here
// (small models often get the date wrong). A weekday means its next one, never today.
const DAY_WORDS: Array<[RegExp, number]> = [
  [/\b(domingo|sunday)\b/, 0],
  [/\b(lunes|monday)\b/, 1],
  [/\b(martes|tuesday)\b/, 2],
  [/\b(miercoles|wednesday)\b/, 3],
  [/\b(jueves|thursday)\b/, 4],
  [/\b(viernes|friday)\b/, 5],
  [/\b(sabado|saturday)\b/, 6]
]

export function dateFromWords(userText: string, now = new Date()): string | undefined {
  const words = normalize(userText)
  const day = (offset: number): string =>
    isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
  if (/\bpasado manana\b/.test(words)) return day(2)
  if (/\b(manana|tomorrow)\b/.test(words)) return day(1)
  const weekdays = DAY_WORDS.filter(([re]) => re.test(words))
  if (weekdays.length === 1) {
    const offset = (weekdays[0][1] - now.getDay() + 7) % 7 || 7
    return day(offset)
  }
  if (/\b(hoy|today)\b/.test(words)) return day(0)
  return undefined
}

const FINISHED = /\b(termine|acabe|ya hice|complete|i finished|i m done|done with)\b/

// "ya terminé mate": if Dip forgot to propose it, propose completing that task anyway.
export function finishedTask(userText: string, tasks: Task[]): DipAction | undefined {
  const words = normalize(userText)
  if (!FINISHED.test(words)) return undefined
  const task = findTask(userText, tasks)
  if (!task || scoreTask(words, task) < 30) return undefined
  return { type: 'complete', taskId: task.id, taskTitle: task.title }
}
