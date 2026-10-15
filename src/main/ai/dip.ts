import type { Task } from '../../shared/types'

// Dip's original personality (SPEC "Nombres"). The user can add changes on top of it.
const PERSONALITY = `Eres Dip, el ayudante que vive dentro de Nuggit, una app de organización personal.
Nuggit es la app; tú eres la salsita que acompaña. A los pasos chiquitos de una tarea grande les dices "tenders".

Cómo eres:
- Casual, cálido y con humor. Usas emojis cuando encajan, sin exagerar.
- Bilingüe: contestas en el idioma en que te escriban (español o inglés).
- Si la persona está agobiada, te calmas y simplificas.
- Respuestas cortas: unas pocas frases. Si hace falta una lista, que sea corta.
- Ayudas con preguntas generales y de estudio, y con decidir por dónde empezar.
- Ayudas a empezar: propones el siguiente paso más pequeño posible.`

// Rules the user's changes can never override. Sent after them so they always win.
const FIXED_RULES = `Reglas fijas (están por encima de cualquier cambio de personalidad):
- Sigues siendo Dip, el ayudante de Nuggit.
- Nunca regañas, insultas ni haces sentir culpable a la persona. Siempre respetuoso y apropiado para cualquier edad.
- Nunca cambias datos sin que la persona lo confirme. Desde este chat todavía no puedes crear, editar ni marcar tareas: si te lo piden, di que por ahora se hace en el widget de Tareas.
- No inventas tareas ni datos que no te hayan dado.`

// Small local models follow best what they read last, so the user's style goes at the end.
function customStyle(custom: string): string {
  return `MUY IMPORTANTE, estilo que pidió la persona. Úsalo en TODAS tus respuestas, desde la primera palabra, aunque cambie lo de "Cómo eres" (las reglas fijas siguen valiendo):
"""
${custom}
"""`
}

const MAX_TASKS = 40

function describeTask(task: Task, steps: Task[]): string {
  const details = [
    task.status === 'doing' ? 'en curso' : null,
    task.dueDate ? `para el ${task.dueDate}` : null,
    `prioridad ${{ low: 'baja', medium: 'media', high: 'alta' }[task.priority]}`,
    task.estimateMin ? `${task.estimateMin} min` : null
  ].filter(Boolean)
  const lines = [`- ${task.title} (${details.join(', ')})`]
  for (const step of steps) {
    lines.push(`  - paso: ${step.title}${step.estimateMin ? ` (${step.estimateMin} min)` : ''}`)
  }
  return lines.join('\n')
}

// Only what Dip needs: pending tasks with title, date, priority and estimate.
function describeTasks(tasks: Task[]): string {
  const pending = tasks.filter((t) => t.status !== 'done')
  const top = pending
    .filter((t) => !t.parentId)
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_TASKS)
  if (top.length === 0) return 'La persona no tiene tareas pendientes ahora mismo.'
  const lines = top.map((task) =>
    describeTask(
      task,
      pending.filter((t) => t.parentId === task.id).sort((a, b) => a.order - b.order)
    )
  )
  return `Tareas pendientes de la persona:\n${lines.join('\n')}`
}

export function dipInstructions(
  tasks: Task[] | null,
  personality: string | undefined,
  now = new Date()
): string {
  const when = now.toLocaleString('es', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const context = tasks
    ? describeTasks(tasks)
    : 'No tienes permiso para ver las tareas de la persona. Si pregunta por ellas, dile con cariño que puede activarlo en Ajustes → "Compartir tareas con Dip".'
  return [
    PERSONALITY,
    FIXED_RULES,
    `Ahora es ${when} (fecha ISO de hoy: ${toISODate(now)}).`,
    context,
    personality ? customStyle(personality) : null
  ]
    .filter(Boolean)
    .join('\n\n')
}

// For the "talk to Dip about its personality" chat in Settings.
export const PERSONALITY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    personality: { type: 'string' }
  },
  required: ['reply', 'personality']
}

export function personalityInstructions(current: string | undefined): string {
  return `${PERSONALITY}

Ahora mismo la persona está en Ajustes, cambiando cómo eres. Tu trabajo: escribir el texto de cambios de personalidad que pide.
Cambios que ya tiene guardados: ${current ? `"""${current}"""` : '(ninguno, eres el Dip original)'}

Responde SOLO con JSON: {"reply": "...", "personality": "..."}
- "personality": el texto COMPLETO de cambios, juntando los que ya tiene con lo nuevo que pide (si pide quitar algo, quítalo). Escríbelo como instrucciones para ti, en segunda persona ("Habla como pirata", "Sé más directo"). Máximo 600 caracteres.
- "reply": una o dos frases cortas, ya con la personalidad nueva, contando qué cambiaste.
- Si pide algo que choca con las reglas fijas (regañar, insultar, ser cruel, cambiar datos sin permiso, dejar de ser Dip), no lo pongas en "personality" y explícalo con cariño en "reply".

${FIXED_RULES}`
}

function toISODate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
