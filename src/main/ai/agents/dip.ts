import { z } from 'zod'
import type { Task } from '../../../shared/types'
import { dipBase, dipInstructions, PERSONALITY_SCHEMA, personalityInstructions } from '../dip'
import type { CheckResult } from '../runAgent'
import { defineAgent, parseJson, plainText } from './types'

// Dip, the plain chat: answers, writes its own new personality (Ajustes) and turns a step
// into a 2-minute version ("Solo empieza").

const Personality = z.object({
  reply: z.string().trim().min(1, '"reply" está vacío'),
  personality: z.string().trim().min(1, '"personality" está vacío')
})

function checkPersonality(raw: string): CheckResult<{ reply: string; personality: string }> {
  return parseJson(raw, Personality)
}

function checkTinyStep(raw: string): CheckResult<string> {
  const answer = raw
    .trim()
    .replace(/^["«]|["»]$/g, '')
    .slice(0, 300)
  if (!answer) return { ok: false, error: 'la respuesta está vacía.' }
  if (answer.split('\n').filter((l) => l.trim()).length > 1) {
    return { ok: false, error: 'tiene que ser UNA sola frase, sin listas ni varias líneas.' }
  }
  return { ok: true, value: answer }
}

export const dip = defineAgent({
  name: 'dip',
  label: 'Dip (chat)',
  purpose: 'Conversa, ayuda a decidir y a empezar.',
  tools: [],
  tasks: {
    chat: {
      system: ({ tasks, personality }: { tasks: Task[] | null; personality?: string }) =>
        dipInstructions(tasks, personality),
      check: plainText(8000)
    },
    personality: {
      system: ({ current }: { current?: string }) => personalityInstructions(current),
      jsonSchema: PERSONALITY_SCHEMA,
      check: checkPersonality
    },
    tinyStep: {
      system: ({ personality }: { personality?: string }) =>
        dipBase(personality, [
          `A la persona le cuesta empezar. Convierte el paso en una versión que tome solo 2 minutos: la primera acción física y concreta (abrir, sacar, escribir una frase...).
Responde con UNA sola frase corta (máximo 25 palabras), sin listas ni comillas, empezando con un verbo.`
        ]),
      check: checkTinyStep
    }
  }
})
