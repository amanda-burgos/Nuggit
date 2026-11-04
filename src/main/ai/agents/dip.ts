import { z } from 'zod'
import { t } from '../../../shared/i18n'
import type { Task } from '../../../shared/types'
import { dipBase, dipInstructions, PERSONALITY_SCHEMA, personalityInstructions } from '../dip'
import { countWords, SUMMARY_MAX_WORDS } from '../chatMemory'
import type { CheckResult } from '../runAgent'
import { defineAgent, parseJson, plainText } from './types'

// Dip, the plain chat: answers, writes its own new personality (Ajustes), turns a step
// into a 2-minute version ("Solo empieza") and keeps the summary of a long chat.

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

function checkSummary(raw: string): CheckResult<string> {
  const summary = raw.trim()
  if (!summary) return { ok: false, error: 'el resumen está vacío.' }
  const words = countWords(summary)
  if (words > SUMMARY_MAX_WORDS) {
    return {
      ok: false,
      error: `tiene ${words} palabras y el máximo es ${SUMMARY_MAX_WORDS}. Acórtalo.`
    }
  }
  return { ok: true, value: summary }
}

export const dip = defineAgent({
  name: 'dip',
  label: 'Dip (chat)',
  get purpose() {
    return t('Conversa, ayuda a decidir y a empezar.', 'Chats, helps you decide and get started.')
  },
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
    },
    summary: {
      system: () =>
        `Resumes una conversación entre una persona y Dip (su compañero para organizar tareas) para que Dip la recuerde después.
Recibes el resumen anterior (si hay) y los mensajes nuevos. Escribe UN solo resumen que junte los dos, de máximo ${SUMMARY_MAX_WORDS} palabras, en tercera persona ("La persona…"), sin títulos ni saludos.
Conserva lo importante: su nombre y lo que contó de sí misma, tareas, fechas y plazos que mencionó, lo que decidió, las acciones que guardó, canceló o deshizo, y cómo se siente. Quita la charla que ya no importa.
Responde solo con el resumen.`,
      check: checkSummary
    }
  }
})
