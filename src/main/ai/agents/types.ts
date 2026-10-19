import { z } from 'zod'
import type { AgentName } from '../config'
import type { CheckResult } from '../runAgent'

// What every agent is (SPEC 8.1): a name, its instructions (system prompt), the schema of
// its answer when it answers with JSON, and which actions it may use. Agent files hold no
// Electron code, so they can be tested with a fake provider.

export interface AgentTask<T, C> {
  system(ctx: C): string // the full system prompt
  jsonSchema?: Record<string, unknown> // sent to the provider; the zod check is what counts
  check(raw: string, ctx: C): CheckResult<T>
}

export interface AgentDefinition {
  name: AgentName
  label: string // as shown in Ajustes
  purpose: string
  tools: readonly string[] // actions it can propose ([] = it only answers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: Record<string, AgentTask<any, any>>
}

export const defineAgent = <A extends AgentDefinition>(agent: A): A => agent

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskContext<X> = X extends AgentTask<any, infer C> ? C : never
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskOutput<X> = X extends AgentTask<infer T, any> ? T : never

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

export const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

// Reads the JSON object in an answer (even wrapped in extra text) and checks it against the
// schema. The error says exactly what is wrong, so the agent can fix it.
export function parseJson<S extends z.ZodType>(raw: string, schema: S): CheckResult<z.infer<S>> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0) return fail('no es JSON: no hay ningún objeto {...}.')
  if (end < start) return fail('no es JSON válido: está incompleto, falta cerrar el objeto.')
  let data: unknown
  try {
    data = JSON.parse(raw.slice(start, end + 1))
  } catch (err) {
    return fail(`no es JSON válido (${(err as Error).message}).`)
  }
  const result = schema.safeParse(data)
  return result.success
    ? { ok: true, value: result.data }
    : fail(`el JSON no sigue el schema:\n${z.prettifyError(result.error)}`)
}

// Answers in plain text (no JSON): only an empty answer is wrong.
export function plainText(max: number): (raw: string) => CheckResult<string> {
  return (raw: string): CheckResult<string> => {
    const answer = raw.trim().slice(0, max)
    return answer ? { ok: true, value: answer } : fail('la respuesta está vacía.')
  }
}

export const DATE = /^\d{4}-\d{2}-\d{2}$/
export const isoDateOrEmpty = z
  .string()
  .refine(
    (d) => d === '' || (DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00`))),
    'tiene que ser una fecha AAAA-MM-DD o "" (vacío)'
  )

export function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Small models are bad at calendar maths: give them the next days ready-made.
export function nextDays(now = new Date()): string {
  const days: string[] = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const name = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${WEEKDAYS[d.getDay()]}`
    days.push(`${name} (${WEEKDAYS[d.getDay()]}) = ${isoDate(d)}`)
  }
  return days.join('; ')
}

// "Haz 2 o 3 preguntas" (Tenderizer and Dailies).
export const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions']
}
const Questions = z.object({
  questions: z
    .array(z.string())
    .transform((qs) => qs.map((q) => text(q, 200)).filter(Boolean))
    .pipe(z.array(z.string()).min(1, 'tiene que haber al menos una pregunta'))
})

export function checkQuestions(raw: string): CheckResult<string[]> {
  const parsed = parseJson(raw, Questions)
  return parsed.ok ? { ok: true, value: parsed.value.questions.slice(0, 3) } : parsed
}
