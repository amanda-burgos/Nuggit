import { z } from 'zod'
import { t } from '../../../shared/i18n'
import type { DailyInput, DailyRepeat } from '../../../shared/types'
import { dipBase } from '../dip'
import type { CheckResult } from '../runAgent'
import {
  checkQuestions,
  defineAgent,
  fail,
  isoDate,
  parseJson,
  QUESTIONS_SCHEMA,
  text
} from './types'

// SPEC 9.13, "Planear con Dip": asks 2 or 3 short questions about a routine, then proposes
// dailies. It only proposes: the interface saves them if the user approves.

const MAX_DAILIES = 12

interface Context {
  personality?: string
}

export type PlannedDaily = Required<Pick<DailyInput, 'title' | 'repeat'>> & DailyInput

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

const Plan = z.object({
  dailies: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'cada daily necesita un "title"'),
        days: z.array(z.string()),
        everyDays: z.number().int().min(0, '"everyDays" va de 0 en adelante'),
        time: z
          .string()
          .refine(
            (t) => t === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
            'tiene que ser "HH:MM" en 24 horas o "" (vacío)'
          ),
        minutes: z.number().min(0)
      })
    )
    .min(1, 'tiene que haber al menos un daily')
})

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

function toRepeat(days: string[], everyDays: number): DailyRepeat {
  if (everyDays >= 2 && everyDays <= 30) {
    return { kind: 'every-n', n: everyDays, start: isoDate(new Date()) }
  }
  const names = days.map(normalize)
  if (names.some((d) => /^(todos|todo|diario|every|daily|all)/.test(d)))
    return { kind: 'every-day' }
  const picked = [
    ...new Set(names.flatMap((d) => DAY_NAMES.filter(([re]) => re.test(d)).map(([, day]) => day)))
  ].sort()
  if (picked.length === 0 || picked.length === 7) return { kind: 'every-day' }
  return { kind: 'weekdays', days: picked }
}

function checkPlan(raw: string): CheckResult<PlannedDaily[]> {
  const parsed = parseJson(raw, Plan)
  if (!parsed.ok) return parsed
  const dailies = parsed.value.dailies.slice(0, MAX_DAILIES).map((d): PlannedDaily => ({
    title: text(d.title, 200),
    repeat: toRepeat(d.days, d.everyDays),
    ...(d.time ? { time: d.time } : {}),
    ...(d.minutes > 0 ? { estimateMin: Math.min(Math.round(d.minutes), 240) } : {}),
    streak: true
  }))
  return dailies.length ? { ok: true, value: dailies } : fail('no hay ningún daily.')
}

export const dailies = defineAgent({
  name: 'dailies',
  label: 'Dailies',
  get purpose() {
    return t('Arma rutinas de cosas que se repiten.', 'Builds routines of things that repeat.')
  },
  tools: [],
  tasks: {
    questions: {
      system: ({ personality }: Context) =>
        dipBase(personality, [
          `Vas a ayudar a armar una rutina de cosas que se repiten ("dailies"). Antes, haz 2 o 3 preguntas cortas (máximo 12 palabras cada una) para entender lo que necesitas: qué días, a qué hora, qué ya hace... Solo lo que sirva para armarla bien, nada obvio.
Responde SOLO con JSON: {"questions": ["...", "..."]}`
        ]),
      jsonSchema: QUESTIONS_SCHEMA,
      check: checkQuestions
    },
    plan: {
      system: ({ personality }: Context) =>
        dipBase(personality, [
          `Propón los "dailies" (cosas que se repiten) de la rutina de la persona. Pocos y realistas: entre 2 y 8.
- "title": corto, empezando con un verbo si se puede ("Ir al gimnasio", "Bañarme").
- "days": los días en que toca: ["todos"] para todos los días, o algunos de ["lun","mar","mie","jue","vie","sab","dom"].
- "everyDays": 0, salvo que sea "cada X días" (entonces X, y "days" vacío).
- "time": la hora "HH:MM" en 24 horas si la dijo, si no "".
- "minutes": cuánto dura, aproximado.
Responde SOLO con JSON: {"dailies": [{"title": "...", "days": ["todos"], "everyDays": 0, "time": "", "minutes": 15}]}`
        ]),
      jsonSchema: PLAN_SCHEMA,
      check: checkPlan
    }
  }
})
