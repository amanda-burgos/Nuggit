import type { TenderAnswer, TenderPlanResult, TenderQuestionsResult } from '../../shared/types'
import { loadSettings } from '../storage'
import { tenderizer } from './agents'
import { cleanSteps } from './agents/tenderizer'
import { text } from './agents/types'
import { askAgent, errorMessage } from './index'

// SPEC 9.3: the Tenderizer agent asks 2 or 3 short questions about a big task, then
// proposes small steps. Nothing is saved here: the interface shows the steps to edit and
// saves them only when the user says so. The prompts and checks live in agents/tenderizer.

const MAX_TASK = 300
const MAX_ANSWER = 500

// --- 1. Questions ---

export async function tenderQuestions(input: unknown): Promise<TenderQuestionsResult> {
  const task = text(input, MAX_TASK)
  if (!task) return { ok: false, error: 'Escribe primero la tarea grande.' }
  try {
    const settings = await loadSettings()
    const { value: questions } = await askAgent(
      tenderizer,
      'questions',
      { personality: settings.dipPersonality },
      [{ role: 'user', content: `Tarea grande: "${task}"` }]
    )
    return { ok: true, questions }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// --- 2. Steps ---

function cleanAnswers(value: unknown): TenderAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((a) => ({
      question: text((a as TenderAnswer)?.question, 200),
      answer: text((a as TenderAnswer)?.answer, MAX_ANSWER)
    }))
    .filter((a) => a.question)
}

export async function proposeTenders(input: unknown): Promise<TenderPlanResult> {
  const request = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >
  const task = text(request.task, MAX_TASK)
  if (!task) return { ok: false, error: 'Escribe primero la tarea grande.' }
  const answers = cleanAnswers(request.answers).filter((a) => a.answer)
  const feedback = text(request.feedback, MAX_ANSWER)
  const previous = cleanSteps(request.previous, false)

  const lines = [`Tarea grande: "${task}"`]
  if (answers.length) {
    lines.push('Lo que contestó la persona:')
    for (const a of answers) lines.push(`- ${a.question} → ${a.answer}`)
  }
  if (feedback && previous.length) {
    lines.push('Tu propuesta anterior era:')
    previous.forEach((s, i) => lines.push(`${i + 1}. ${s.title} (${s.minutes} min)`))
    lines.push(
      `La persona quiere este cambio: "${feedback}". Haz una propuesta nueva con ese cambio.`
    )
  }

  try {
    const settings = await loadSettings()
    const { value: plan } = await askAgent(
      tenderizer,
      'plan',
      { personality: settings.dipPersonality },
      [{ role: 'user', content: lines.join('\n') }]
    )
    return { ok: true, ...plan, title: plan.title || task }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
