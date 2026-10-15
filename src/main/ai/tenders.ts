import type {
  TenderAnswer,
  TenderPlanResult,
  TenderQuestionsResult,
  TenderStep
} from '../../shared/types'
import { loadSettings } from '../storage'
import { dipBase } from './dip'
import { errorMessage, withFallback } from './index'
import { AIError } from './provider'

// SPEC 9.3: Dip asks 2 or 3 short questions about a big task, then proposes small steps
// (5–25 min each). Nothing is saved here: the interface shows the steps to edit and saves
// them only when the user says so. Every AI answer is JSON, checked before use.

const MAX_TASK = 300
const MAX_ANSWER = 500
const MAX_STEPS = 15
const MIN_MINUTES = 5
const MAX_MINUTES = 25
const DATE = /^\d{4}-\d{2}-\d{2}$/

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions']
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    dueDate: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, minutes: { type: 'integer' } },
        required: ['title', 'minutes']
      }
    }
  },
  required: ['title', 'dueDate', 'steps']
}

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

// Reads the JSON object in a model's answer, even if it came wrapped in extra text.
function parseObject(raw: string): Record<string, unknown> {
  try {
    const data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    if (typeof data === 'object' && data !== null) return data as Record<string, unknown>
  } catch {
    // falls through
  }
  throw new AIError('Dip se enredó con la respuesta. ¿Lo intentas otra vez?')
}

async function ask(instructions: string, request: string, schema: object): Promise<string> {
  const settings = await loadSettings()
  const system = dipBase(settings.dipPersonality, [instructions])
  const { value } = await withFallback(settings, (provider) =>
    provider.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: request }
      ],
      { schema: schema as Record<string, unknown> }
    )
  )
  return value
}

// --- 1. Questions ---

export async function tenderQuestions(input: unknown): Promise<TenderQuestionsResult> {
  const task = text(input, MAX_TASK)
  if (!task) return { ok: false, error: 'Escribe primero la tarea grande.' }
  try {
    const raw = await ask(
      `Vas a ayudar a dividir una tarea grande en pasos chiquitos. Antes, haz 2 o 3 preguntas cortas (máximo 12 palabras cada una) para entender lo que necesitas: para cuándo es, qué tiene ya hecho, si es en grupo, qué le piden... Solo pregunta lo que sirva para dividirla bien, nada obvio.
Responde SOLO con JSON: {"questions": ["...", "..."]}`,
      `Tarea grande: "${task}"`,
      QUESTIONS_SCHEMA
    )
    const data = parseObject(raw)
    const questions = (Array.isArray(data.questions) ? data.questions : [])
      .map((q) => text(q, 200))
      .filter(Boolean)
      .slice(0, 3)
    if (questions.length === 0)
      throw new AIError('Dip no supo qué preguntar. ¿Lo intentas otra vez?')
    return { ok: true, questions }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// --- 2. Steps ---

function cleanAnswers(value: unknown): TenderAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((a) => ({
      question: text((a as TenderAnswer)?.question, 200),
      answer: text((a as TenderAnswer)?.answer, MAX_ANSWER)
    }))
    .filter((a) => a.question)
}

function cleanSteps(value: unknown, clampMinutes: boolean): TenderStep[] {
  if (!Array.isArray(value)) return []
  return value
    .map((s) => {
      const step = (typeof s === 'object' && s !== null ? s : {}) as Record<string, unknown>
      const minutes = Number.isFinite(step.minutes) ? Math.round(step.minutes as number) : 10
      return {
        title: text(step.title, 200),
        minutes: clampMinutes
          ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes))
          : Math.min(600, Math.max(1, minutes))
      }
    })
    .filter((s) => s.title)
    .slice(0, MAX_STEPS)
}

// A due date the model worked out from the answers; ignored if it is invalid or in the past.
function cleanDueDate(value: unknown): string | undefined {
  const date = text(value, 10)
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) return undefined
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return date >= today ? date : undefined
}

export async function proposeTenders(input: unknown): Promise<TenderPlanResult> {
  const request = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >
  const task = text(request.task, MAX_TASK)
  if (!task) return { ok: false, error: 'Escribe primero la tarea grande.' }
  const answers = cleanAnswers(request.answers).filter((a) => a.answer)
  const feedback = text(request.feedback, MAX_ANSWER)
  const previous = cleanSteps(request.previous, false)

  const lines = [`Tarea grande: "${task}"`]
  if (answers.length) {
    lines.push('Lo que contestó la persona:')
    for (const a of answers) lines.push(`- ${a.question} → ${a.answer}`)
  }
  if (feedback && previous.length) {
    lines.push('Tu propuesta anterior era:')
    previous.forEach((s, i) => lines.push(`${i + 1}. ${s.title} (${s.minutes} min)`))
    lines.push(
      `La persona quiere este cambio: "${feedback}". Haz una propuesta nueva con ese cambio.`
    )
  }

  try {
    const raw = await ask(
      `Divide la tarea grande en pasos chiquitos ("tenders") para alguien a quien le cuesta empezar.
- Entre 3 y 10 pasos, en el orden en que se hacen.
- Cada paso es una acción concreta que se puede empezar ya. Empieza con un verbo ("Buscar...", "Escribir...").
- Cada paso dura entre 5 y 25 minutos. El primero es muy fácil (5 a 10 minutos) para arrancar sin miedo.
- "title": un nombre corto y claro para la tarea grande.
- "dueDate": la fecha límite en formato AAAA-MM-DD si la persona la dijo (calcúlala desde hoy). Si no la dijo, "".
Responde SOLO con JSON: {"title": "...", "dueDate": "", "steps": [{"title": "...", "minutes": 10}]}`,
      lines.join('\n'),
      PLAN_SCHEMA
    )
    const data = parseObject(raw)
    const steps = cleanSteps(data.steps, true)
    if (steps.length === 0)
      throw new AIError('Dip no logró armar los pasos. ¿Lo intentas otra vez?')
    const dueDate = cleanDueDate(data.dueDate)
    return {
      ok: true,
      title: text(data.title, 200) || task,
      steps,
      ...(dueDate ? { dueDate } : {})
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
