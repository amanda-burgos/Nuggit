import type { AIBackend, AIMessage, DipAction, Task } from '../../shared/types'
import { pickNextActions } from '../../shared/nextAction'
import { getNextActionState } from '../nextAction'
import { loadSettings } from '../storage'
import { getTasks } from '../tasks'
import { actions } from './agents'
import { isoDate } from './agents/types'
import { askAgent } from './index'

// The Dip chat with actions. The agent (prompt, schema and checks) is in agents/actions;
// here it gets what it needs from this computer: the tasks and the Next Action suggestion.

// What the Next Action widget shows, so "¿qué hago ahora?" gets the same answer everywhere.
function nextActionContext(tasks: Task[]): string {
  const [next, ...later] = pickNextActions(tasks, getNextActionState(), isoDate(new Date()))
  if (!next) return ''
  const name = (a: typeof next): string =>
    a.task === a.root ? `"${a.task.title}"` : `"${a.task.title}" (paso de "${a.root.title}")`
  return `Si pregunta qué hacer ahora, Nuggit sugiere: ${name(next)}${
    next.minutes ? `, unos ${next.minutes} min` : ''
  }.${later.length ? ` Después: ${later.map(name).join(', ')}.` : ''} Sugiere eso mismo, con ánimo.`
}

export async function chatWithActions(
  messages: AIMessage[]
): Promise<{ text: string; action?: DipAction; backend: AIBackend }> {
  const settings = await loadSettings()
  const tasks = getTasks()
  const shareTasks = settings.ai.shareTasksWithAI
  const { value, backend } = await askAgent(
    actions,
    'reply',
    {
      tasks,
      shareTasks,
      personality: settings.dipPersonality,
      nextAction: shareTasks ? nextActionContext(tasks) : '',
      userText: messages[messages.length - 1]?.content ?? ''
    },
    messages
  )
  return { ...value, backend }
}
