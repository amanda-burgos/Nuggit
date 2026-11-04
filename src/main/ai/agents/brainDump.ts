import { z } from 'zod'
import { t } from '../../../shared/i18n'
import type { BrainDumpTask } from '../../../shared/types'
import { dipBase } from '../dip'
import type { CheckResult } from '../runAgent'
import { defineAgent, fail, isoDateOrEmpty, nextDays, parseJson, text } from './types'

// SPEC 9.6, Brain Dump: the person lets out everything on their mind in one go, and this
// agent splits it into tasks (things to do) and notes (everything else). It only proposes:
// the interface shows both lists to edit and saves them when the person says so.

const MAX_ITEMS = 20

interface Context {
  personality?: string
}

export interface BrainDumpSplit {
  tasks: BrainDumpTask[]
  notes: string[]
}

const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dueDate: { type: 'string' },
          priority: { type: 'string', enum: ['', 'low', 'medium', 'high'] }
        },
        required: ['title', 'dueDate', 'priority']
      }
    },
    notes: { type: 'array', items: { type: 'string' } }
  },
  required: ['tasks', 'notes']
}

const Split = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      dueDate: isoDateOrEmpty.default(''),
      priority: z.enum(['', 'low', 'medium', 'high']).default('')
    })
  ),
  notes: z.array(z.string())
})

function checkSplit(raw: string): CheckResult<BrainDumpSplit> {
  const parsed = parseJson(raw, Split)
  if (!parsed.ok) return parsed
  const tasks = parsed.value.tasks
    .map((t): BrainDumpTask => ({
      title: text(t.title, 200),
      ...(t.dueDate ? { dueDate: t.dueDate } : {}),
      ...(t.priority ? { priority: t.priority } : {})
    }))
    .filter((t) => t.title)
    .slice(0, MAX_ITEMS)
  const notes = parsed.value.notes
    .map((n) => text(n, 2000))
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
  if (tasks.length === 0 && notes.length === 0) {
    return fail(
      '"tasks" y "notes" están vacíos: cada cosa del texto tiene que ir en uno de los dos.'
    )
  }
  return { ok: true, value: { tasks, notes } }
}

export const brainDump = defineAgent({
  name: 'brainDump',
  label: 'Brain Dump',
  get purpose() {
    return t(
      'Separa lo que sueltas en tareas y notas.',
      'Sorts what you let out into tasks and notes.'
    )
  },
  tools: [],
  tasks: {
    split: {
      system: ({ personality }: Context) =>
        dipBase(personality, [
          `La persona soltó todo lo que tiene en la cabeza, rápido y desordenado. Sepáralo en tareas y notas.
- "tasks": cosas que tiene que HACER. "title": corto, empezando con un verbo ("Estudiar para mate", "Comprar cartulina"). Una tarea por cosa; no juntes dos cosas en una.
- "dueDate": AAAA-MM-DD solo si dijo cuándo, si no "". Fechas: ${nextDays()}.
- "priority": "high" solo si dijo que es urgente o importante, si no "".
- "notes": todo lo demás (ideas, datos, cosas que recordar, cómo se siente), con sus palabras, una nota por tema.
- No inventes nada que no haya dicho y no dejes nada fuera.
Responde SOLO con JSON: {"tasks": [{"title": "...", "dueDate": "", "priority": ""}], "notes": ["..."]}`
        ]),
      jsonSchema: SCHEMA,
      check: checkSplit
    }
  }
})
