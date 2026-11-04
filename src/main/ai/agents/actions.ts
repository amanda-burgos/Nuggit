import { z } from 'zod'
import { t } from '../../../shared/i18n'
import type { DipAction, Task } from '../../../shared/types'
import { dipInstructions } from '../dip'
import type { CheckResult } from '../runAgent'
import { dateFromWords, finishedTask, pickTask } from '../taskMatch'
import { defineAgent, fail, isoDateOrEmpty, nextDays, parseJson, text } from './types'

// The Dip chat with actions: a reply plus, optionally, ONE action on the tasks. The action
// is only a proposal; the interface shows it as a card and the user confirms it. Dip names
// existing tasks by their title ("mate") and Nuggit finds them here, so Dip can complete or
// change tasks without being sent the task list. If the task doesn't exist, Dip is told so
// and gets to fix its answer (or ask).

export interface ActionsContext {
  tasks: Task[] // all of them, to find the one Dip names (never sent without permission)
  shareTasks: boolean
  personality?: string
  nextAction: string // what the Next Action widget suggests ('' if nothing / not shared)
  userText: string // the user's last message
  voice?: boolean // said in a call: answer short and spoken
  summary?: string // the older part of the chat, summarized (SPEC 9.4)
  help?: string // the Ayuda texts that match a "¿cómo hago X?" question (Fase 10)
}

export interface ActionsReply {
  text: string
  action?: DipAction
}

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

const Reply = z.object({
  reply: z.string(),
  action: z.object({
    type: z.enum(['none', 'create', 'complete', 'update']),
    task: z.string().default(''),
    title: z.string().default(''),
    dueDate: isoDateOrEmpty.default(''),
    priority: z.enum(['', 'low', 'medium', 'high']).default('')
  })
})
type RawAction = z.infer<typeof Reply>['action']

// SPEC 9.10, call mode: the answer is read aloud and the person answers by voice.
const CALL_STYLE = `MUY IMPORTANTE: estás en una LLAMADA de voz con la persona. Tu "reply" se lee en voz alta:
- Contesta como hablando, en 1 o 2 frases cortas. Sin listas, sin emojis, sin markdown.
- Si propones una acción, termina "reply" preguntando "¿La guardo?" (o "¿La marco como hecha?"), porque la persona contesta "sí" o "no" con la voz.`

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

// Turns Dip's action into a real one. If it names a task that doesn't exist, the error goes
// back to Dip, who can fix the name or ask the person.
function toAction(a: RawAction, ctx: ActionsContext): CheckResult<DipAction | undefined> {
  // When the user said a day in words, our date beats the model's (or fills it in).
  const dueDate = dateFromWords(ctx.userText) ?? (a.dueDate || undefined)
  const fields = {
    ...(dueDate ? { dueDate } : {}),
    ...(a.priority ? { priority: a.priority } : {})
  }
  if (a.type === 'create') {
    const title = text(a.title, 200) || text(a.task, 200)
    if (!title) return fail('"action.title" está vacío: di el nombre de la tarea nueva.')
    return { ok: true, value: { type: 'create', title, ...fields } }
  }
  if (a.type === 'complete' || a.type === 'update') {
    const name = text(a.task, 200) || text(a.title, 200)
    const task = pickTask(name, ctx.userText, ctx.tasks)
    if (!task) {
      return fail(
        name
          ? `no existe una tarea pendiente que se llame "${name}". Si no sabes cuál es, usa "type": "none" y pregúntale a la persona en "reply".`
          : '"action.task" está vacío: di qué tarea es, o usa "type": "none" y pregúntale.'
      )
    }
    if (a.type === 'complete') {
      return { ok: true, value: { type: 'complete', taskId: task.id, taskTitle: task.title } }
    }
    const title = text(a.title, 200)
    const changes = { ...(title && title !== task.title ? { title } : {}), ...fields }
    if (Object.keys(changes).length === 0) return { ok: true, value: undefined }
    return { ok: true, value: { type: 'update', taskId: task.id, taskTitle: task.title, changes } }
  }
  return { ok: true, value: undefined }
}

function checkReply(raw: string, ctx: ActionsContext): CheckResult<ActionsReply> {
  const parsed = parseJson(raw, Reply)
  if (!parsed.ok) return parsed
  const found = toAction(parsed.value.action, ctx)
  if (!found.ok) return found
  // "ya terminé mate": if Dip forgot to propose it, propose completing that task anyway.
  const action = found.value ?? finishedTask(ctx.userText, ctx.tasks)
  const reply = text(parsed.value.reply, 4000) || (action ? t('¿Lo hago?', 'Should I do it?') : '')
  if (!reply) return fail('"reply" está vacío: contéstale algo a la persona.')
  return { ok: true, value: { text: reply, ...(action ? { action } : {}) } }
}

export const actions = defineAgent({
  name: 'actions',
  get label() {
    return t('Acciones de Dip', "Dip's actions")
  },
  get purpose() {
    return t(
      'El chat de Dip que propone crear, completar o cambiar tareas.',
      "Dip's chat that suggests creating, completing or changing tasks."
    )
  },
  tools: ['create', 'complete', 'update'],
  tasks: {
    reply: {
      system: (ctx: ActionsContext) =>
        dipInstructions(ctx.shareTasks ? ctx.tasks : null, ctx.personality, [
          ctx.nextAction,
          ctx.summary
            ? `Lo que ya hablaron antes en este chat (resumen; los mensajes siguientes van completos): ${ctx.summary}`
            : '',
          ctx.help ?? '',
          actionInstructions(),
          ctx.voice ? CALL_STYLE : ''
        ]),
      jsonSchema: SCHEMA,
      check: checkReply
    }
  }
})
