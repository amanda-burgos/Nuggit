import type { AIBackend, DipAction, Priority, Task } from '../../shared/types'
import { pickNextActions } from '../../shared/nextAction'
import { getNextActionState } from '../nextAction'
import { loadSettings } from '../storage'
import { getTasks } from '../tasks'
import { dipInstructions } from './dip'
import { withFallback } from './index'
import type { AIMessage } from '../../shared/types'

// The Dip chat answers with JSON: a reply plus, optionally, ONE action on the tasks. The
// action is only a proposal; the interface shows it as a card and the user confirms it.
// Dip names existing tasks by their title ("mate"), and Nuggit finds them here, on this
// computer, so Dip can complete or change tasks without being sent the task list.

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    action: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['none', 'create', 'complete', 'update'] },
        task: { type: 'string' },
        title: { type: 'string' },
        dueDate: { type: 'string' },
        priority: { type: 'string' }
      },
      required: ['type', 'task', 'title', 'dueDate', 'priority']
    }
  },
  required: ['reply', 'action']
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Small models are bad at calendar maths: give them the next days ready-made.
function nextDays(now = new Date()): string {
  const days: string[] = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const name = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${WEEKDAYS[d.getDay()]}`
    days.push(`${name} (${WEEKDAYS[d.getDay()]}) = ${isoDate(d)}`)
  }
  return days.join('; ')
}

function actionInstructions(): string {
  return `Acciones: además de contestar, puedes proponer UNA acción sobre las tareas en "action", solo si la persona la pide o es claramente lo que quiere:
- "create": anotar una tarea nueva. "title": el nombre corto, sin la fecha ("Tarea de lengua"). "dueDate": AAAA-MM-DD si dijo cuándo, si no "". "priority": "high" solo si dijo que es urgente o importante, si no "".
- "complete": dice que terminó algo ("ya terminé mate"). "task": el nombre de esa tarea, como lo dijo.
- "update": cambiar una tarea que ya existe (fecha, nombre o prioridad). "task": cuál es; y en "title", "dueDate" o "priority" solo lo nuevo (lo demás vacío).
- "none": si no hay nada que cambiar. Es lo normal en una conversación.
Fechas: ${nextDays()}.
La app le muestra la acción a la persona para que la confirme. En "reply" di lo que propones en una frase ("¿La anoto para el jueves?"); nunca digas que ya está hecho.
Responde SOLO con JSON: {"reply": "...", "action": {"type": "none", "task": "", "title": "", "dueDate": "", "priority": ""}}`
}

// --- Finding a task by what Dip called it ---

function normalize(text: string): string {
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
function pickTask(dipName: string, userText: string, tasks: Task[]): Task | undefined {
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

// --- Reading Dip's answer ---

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function cleanDate(value: unknown): string | undefined {
  const date = text(value, 10)
  return DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00`)) ? date : undefined
}

function cleanPriority(value: unknown): Priority | undefined {
  const p = text(value, 10)
  return p === 'high' || p === 'medium' || p === 'low' ? p : undefined
}

// Turns the model's action into a real one, or a note saying why it can't be done.
function toAction(
  raw: unknown,
  tasks: Task[],
  userText: string
): { action?: DipAction; note?: string } {
  if (typeof raw !== 'object' || raw === null) return {}
  const a = raw as Record<string, unknown>
  // When the user said a day in words, our date beats the model's (or fills it in).
  const dueDate =
    (dateFromWords(userText) ?? cleanDate(a.dueDate))
      ? (dateFromWords(userText) ?? cleanDate(a.dueDate))
      : undefined
  const fields = {
    ...(dueDate ? { dueDate } : {}),
    ...(cleanPriority(a.priority) ? { priority: cleanPriority(a.priority) } : {})
  }
  if (a.type === 'create') {
    const title = text(a.title, 200) || text(a.task, 200)
    return title ? { action: { type: 'create', title, ...fields } } : {}
  }
  if (a.type === 'complete' || a.type === 'update') {
    const name = text(a.task, 200) || text(a.title, 200)
    const task = pickTask(name, userText, tasks)
    if (!task)
      return {
        note: name ? `(No encontré una tarea pendiente que se llame "${name}".)` : undefined
      }
    if (a.type === 'complete')
      return { action: { type: 'complete', taskId: task.id, taskTitle: task.title } }
    const title = text(a.title, 200)
    const changes = { ...(title && title !== task.title ? { title } : {}), ...fields }
    if (Object.keys(changes).length === 0) return {}
    return { action: { type: 'update', taskId: task.id, taskTitle: task.title, changes } }
  }
  return {}
}

const FINISHED = /\b(termine|acabe|ya hice|complete|i finished|i m done|done with)\b/

// "ya terminé mate": if Dip forgot to propose it, propose completing that task anyway.
function finishedTask(userText: string, tasks: Task[]): DipAction | undefined {
  const words = normalize(userText)
  if (!FINISHED.test(words)) return undefined
  const task = findTask(userText, tasks)
  if (!task || scoreTask(words, task) < 30) return undefined
  return { type: 'complete', taskId: task.id, taskTitle: task.title }
}

function parse(raw: string, tasks: Task[], userText: string): { text: string; action?: DipAction } {
  let data: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    if (typeof parsed === 'object' && parsed !== null) data = parsed as Record<string, unknown>
  } catch {
    // not JSON: use the answer as plain text
  }
  const fallback = finishedTask(userText, tasks)
  if (!data) return { text: raw.trim(), ...(fallback ? { action: fallback } : {}) }
  const found = toAction(data.action, tasks, userText)
  const action = found.action ?? fallback
  const note = action ? undefined : found.note
  const reply = text(data.reply, 4000) || (action ? '¿Lo hago?' : '')
  return {
    text: [reply, note].filter(Boolean).join('\n\n') || raw.trim(),
    ...(action ? { action } : {})
  }
}

// What the Next Action widget shows, so "¿qué hago ahora?" gets the same answer everywhere.
function nextActionContext(tasks: Task[]): string {
  const [next, ...later] = pickNextActions(tasks, getNextActionState(), isoDate(new Date()))
  if (!next) return ''
  const name = (a: typeof next): string =>
    a.task === a.root ? `"${a.task.title}"` : `"${a.task.title}" (paso de "${a.root.title}")`
  return `Si pregunta qué hacer ahora, Nuggit sugiere: ${name(next)}${
    next.minutes ? `, unos ${next.minutes} min` : ''
  }.${later.length ? ` Después: ${later.map(name).join(', ')}.` : ''} Sugiere eso mismo, con ánimo.`
}

export async function chatWithActions(
  messages: AIMessage[]
): Promise<{ text: string; action?: DipAction; backend: AIBackend }> {
  const settings = await loadSettings()
  const tasks = getTasks()
  const system = dipInstructions(
    settings.ai.shareTasksWithAI ? tasks : null,
    settings.dipPersonality,
    [settings.ai.shareTasksWithAI ? nextActionContext(tasks) : '', actionInstructions()]
  )
  const { value, backend } = await withFallback(settings, (provider) =>
    provider.chat([{ role: 'system', content: system }, ...messages], { schema: SCHEMA })
  )
  const userText = messages[messages.length - 1]?.content ?? ''
  return { ...parse(value, tasks, userText), backend }
}
