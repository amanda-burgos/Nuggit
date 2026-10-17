import type {
  DailyInput,
  DailyPlanResult,
  DailyRepeat,
  TenderAnswer,
  TenderQuestionsResult
} from '../../shared/types'
import { describeRepeat } from '../../shared/dailies'
import { errorMessage } from './index'
import { AIError } from './provider'
import { askJson, parseObject, text } from './structured'

// SPEC 9.13, "Planear con Dip": Dip asks 2 or 3 short questions about the routine, then
// proposes dailies. Nothing is saved here: the interface shows them to edit and saves them
// only when the user approves. Every answer is JSON, checked before use.

const MAX_REQUEST = 500
const MAX_ANSWER = 500
const MAX_DAILIES = 12

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions']
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    dailies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          days: { type: 'array', items: { type: 'string' } },
          everyDays: { type: 'integer' },
          time: { type: 'string' },
          minutes: { type: 'integer' }
        },
        required: ['title', 'days', 'everyDays', 'time', 'minutes']
      }
    }
  },
  required: ['dailies']
}

// "lun", "lunes", "monday", "miércoles"... → 0 (Sunday) … 6 (Saturday).
const DAY_NAMES: Array<[RegExp, number]> = [
  [/^(dom|sun)/, 0],
  [/^(lun|mon)/, 1],
  [/^(mar|tue)/, 2],
  [/^(mie|wed)/, 3],
  [/^(jue|thu)/, 4],
  [/^(vie|fri)/, 5],
  [/^(sab|sat)/, 6]
]

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function toRepeat(days: unknown, everyDays: unknown): DailyRepeat {
  const n = Number.isInteger(everyDays) ? (everyDays as number) : 0
  if (n >= 2 && n <= 30) return { kind: 'every-n', n, start: today() }
  const names = (Array.isArray(days) ? days : []).map((d) => normalize(String(d)))
  if (names.some((d) => /^(todos|todo|diario|every|daily|all)/.test(d)))
    return { kind: 'every-day' }
  const picked = [
    ...new Set(names.flatMap((d) => DAY_NAMES.filter(([re]) => re.test(d)).map(([, day]) => day)))
  ].sort()
  if (picked.length === 0 || picked.length === 7) return { kind: 'every-day' }
  return { kind: 'weekdays', days: picked }
}

function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

type PlannedDaily = Required<Pick<DailyInput, 'title' | 'repeat'>> & DailyInput

function cleanDailies(value: unknown): PlannedDaily[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): PlannedDaily | null => {
      const d = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
      const title = text(d.title, 200)
      if (!title) return null
      const time = text(d.time, 5)
      const minutes = Number.isFinite(d.minutes) ? Math.round(d.minutes as number) : 0
      return {
        title,
        repeat: toRepeat(d.days, d.everyDays),
        ...(/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? { time } : {}),
        ...(minutes > 0 ? { estimateMin: Math.min(minutes, 240) } : {}),
        streak: true
      }
    })
    .filter((d): d is PlannedDaily => d !== null)
    .slice(0, MAX_DAILIES)
}

function cleanAnswers(value: unknown): TenderAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((a) => ({
      question: text((a as TenderAnswer)?.question, 200),
      answer: text((a as TenderAnswer)?.answer, MAX_ANSWER)
    }))
    .filter((a) => a.question && a.answer)
}

export async function dailyQuestions(input: unknown): Promise<TenderQuestionsResult> {
  const request = text(input, MAX_REQUEST)
  if (!request) return { ok: false, error: 'Cuéntale a Dip qué rutina quieres armar.' }
  try {
    const raw = await askJson(
      `Vas a ayudar a armar una rutina de cosas que se repiten ("dailies"). Antes, haz 2 o 3 preguntas cortas (máximo 12 palabras cada una) para entender lo que necesitas: qué días, a qué hora, qué ya hace... Solo lo que sirva para armarla bien, nada obvio.
Responde SOLO con JSON: {"questions": ["...", "..."]}`,
      `Lo que quiere la persona: "${request}"`,
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

export async function proposeDailies(input: unknown): Promise<DailyPlanResult> {
  const req = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const request = text(req.request, MAX_REQUEST)
  if (!request) return { ok: false, error: 'Cuéntale a Dip qué rutina quieres armar.' }
  const answers = cleanAnswers(req.answers)
  const feedback = text(req.feedback, MAX_ANSWER)
  const previous = (Array.isArray(req.previous) ? req.previous : []).slice(0, MAX_DAILIES)

  const lines = [`Lo que quiere la persona: "${request}"`]
  if (answers.length) {
    lines.push('Lo que contestó:')
    for (const a of answers) lines.push(`- ${a.question} → ${a.answer}`)
  }
  if (feedback && previous.length) {
    lines.push('Tu propuesta anterior era:')
    for (const d of previous as Array<Record<string, unknown>>) {
      const repeat = toRepeatFromInput(d?.repeat)
      lines.push(`- ${text(d.title, 200)} (${repeat ? describeRepeat(repeat) : 'todos los días'})`)
    }
    lines.push(
      `La persona quiere este cambio: "${feedback}". Haz una propuesta nueva con ese cambio.`
    )
  }

  try {
    const raw = await askJson(
      `Propón los "dailies" (cosas que se repiten) de la rutina de la persona. Pocos y realistas: entre 2 y 8.
- "title": corto, empezando con un verbo si se puede ("Ir al gimnasio", "Bañarme").
- "days": los días en que toca: ["todos"] para todos los días, o algunos de ["lun","mar","mie","jue","vie","sab","dom"].
- "everyDays": 0, salvo que sea "cada X días" (entonces X, y "days" vacío).
- "time": la hora "HH:MM" en 24 horas si la dijo, si no "".
- "minutes": cuánto dura, aproximado.
Responde SOLO con JSON: {"dailies": [{"title": "...", "days": ["todos"], "everyDays": 0, "time": "", "minutes": 15}]}`,
      lines.join('\n'),
      PLAN_SCHEMA
    )
    const dailies = cleanDailies(parseObject(raw).dailies)
    if (dailies.length === 0)
      throw new AIError('Dip no logró armar la rutina. ¿Lo intentas otra vez?')
    return { ok: true, dailies }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// A repeat sent back by the interface (for "Cambiar"), only to describe it to Dip.
function toRepeatFromInput(value: unknown): DailyRepeat | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  if (r.kind === 'every-day') return { kind: 'every-day' }
  if (r.kind === 'weekdays' && Array.isArray(r.days)) {
    const days = r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    return days.length ? { kind: 'weekdays', days } : null
  }
  if (r.kind === 'every-n' && Number.isInteger(r.n) && (r.n as number) >= 2) {
    return { kind: 'every-n', n: r.n as number, start: today() }
  }
  return null
}
