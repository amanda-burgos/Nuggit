import { z } from 'zod'
import type { TenderStep } from '../../../shared/types'
import { dipBase } from '../dip'
import type { CheckResult } from '../runAgent'
import {
  checkQuestions,
  defineAgent,
  fail,
  isoDate,
  isoDateOrEmpty,
  parseJson,
  QUESTIONS_SCHEMA,
  text
} from './types'

// SPEC 9.3, Tenderizer: asks 2 or 3 short questions about a big task, then proposes small
// steps (5–25 min each). It only proposes: the interface saves them if the user says so.

const MAX_STEPS = 15
const MIN_MINUTES = 5
const MAX_MINUTES = 25

interface Context {
  personality?: string
}

export interface TenderPlan {
  title: string
  dueDate?: string
  steps: TenderStep[]
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

const Plan = z.object({
  title: z.string(),
  dueDate: isoDateOrEmpty,
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'cada paso necesita un "title"'),
        minutes: z.number('"minutes" tiene que ser un número de minutos')
      })
    )
    .min(1, 'tiene que haber al menos un paso')
})

// Steps from the model or sent back by the interface ("Cambiar"). The model's minutes are
// kept in 5–25; the user's own edits can be anything sensible.
export function cleanSteps(value: unknown, clampMinutes: boolean): TenderStep[] {
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

function checkPlan(raw: string): CheckResult<TenderPlan> {
  const parsed = parseJson(raw, Plan)
  if (!parsed.ok) return parsed
  const { title, dueDate, steps } = parsed.value
  // A date in the past is a slip, not worth a retry: it is just left out.
  const due = dueDate && dueDate >= isoDate(new Date()) ? dueDate : undefined
  const clean = cleanSteps(steps, true)
  if (clean.length === 0) return fail('tiene que haber al menos un paso con "title".')
  return {
    ok: true,
    value: { title: text(title, 200), steps: clean, ...(due ? { dueDate: due } : {}) }
  }
}

export const tenderizer = defineAgent({
  name: 'tenderizer',
  label: 'Tenderizer',
  purpose: 'Divide una tarea grande en pasos chiquitos.',
  tools: [],
  tasks: {
    questions: {
      system: ({ personality }: Context) =>
        dipBase(personality, [
          `Vas a ayudar a dividir una tarea grande en pasos chiquitos. Antes, haz 2 o 3 preguntas cortas (máximo 12 palabras cada una) para entender lo que necesitas: para cuándo es, qué tiene ya hecho, si es en grupo, qué le piden... Solo pregunta lo que sirva para dividirla bien, nada obvio.
Responde SOLO con JSON: {"questions": ["...", "..."]}`
        ]),
      jsonSchema: QUESTIONS_SCHEMA,
      check: checkQuestions
    },
    plan: {
      system: ({ personality }: Context) =>
        dipBase(personality, [
          `Divide la tarea grande en pasos chiquitos ("tenders") para alguien a quien le cuesta empezar.
- Entre 3 y 10 pasos, en el orden en que se hacen.
- Cada paso es una acción concreta que se puede empezar ya. Empieza con un verbo ("Buscar...", "Escribir...").
- Cada paso dura entre 5 y 25 minutos. El primero es muy fácil (5 a 10 minutos) para arrancar sin miedo.
- "title": un nombre corto y claro para la tarea grande.
- "dueDate": la fecha límite en formato AAAA-MM-DD si la persona la dijo (calcúlala desde hoy). Si no la dijo, "".
Responde SOLO con JSON: {"title": "...", "dueDate": "", "steps": [{"title": "...", "minutes": 10}]}`
        ]),
      jsonSchema: PLAN_SCHEMA,
      check: checkPlan
    }
  }
})
