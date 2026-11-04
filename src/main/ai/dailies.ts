import type {
  DailyPlanResult,
  DailyRepeat,
  TenderAnswer,
  TenderQuestionsResult
} from '../../shared/types'
import { describeRepeat } from '../../shared/dailies'
import { t } from '../../shared/i18n'
import { loadSettings } from '../storage'
import { dailies } from './agents'
import { isoDate, text } from './agents/types'
import { askAgent, errorMessage } from './index'

// SPEC 9.13, "Planear con Dip": the Dailies agent asks 2 or 3 short questions about the
// routine, then proposes dailies. Nothing is saved here: the interface shows them to edit
// and saves them only when the user approves. The prompts and checks live in agents/dailies.

const MAX_REQUEST = 500
const MAX_ANSWER = 500
const MAX_DAILIES = 12

function cleanAnswers(value: unknown): TenderAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((a) => ({
      question: text((a as TenderAnswer)?.question, 200),
      answer: text((a as TenderAnswer)?.answer, MAX_ANSWER)
    }))
    .filter((a) => a.question && a.answer)
}

export async function dailyQuestions(input: unknown): Promise<TenderQuestionsResult> {
  const request = text(input, MAX_REQUEST)
  if (!request)
    return {
      ok: false,
      error: t(
        'Cuéntale a Dip qué rutina quieres armar.',
        'Tell Dip what routine you want to build.'
      )
    }
  try {
    const settings = await loadSettings()
    const { value: questions } = await askAgent(
      dailies,
      'questions',
      { personality: settings.dipPersonality },
      [{ role: 'user', content: `Lo que quiere la persona: "${request}"` }]
    )
    return { ok: true, questions }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function proposeDailies(input: unknown): Promise<DailyPlanResult> {
  const req = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  const request = text(req.request, MAX_REQUEST)
  if (!request)
    return {
      ok: false,
      error: t(
        'Cuéntale a Dip qué rutina quieres armar.',
        'Tell Dip what routine you want to build.'
      )
    }
  const answers = cleanAnswers(req.answers)
  const feedback = text(req.feedback, MAX_ANSWER)
  const previous = (Array.isArray(req.previous) ? req.previous : []).slice(0, MAX_DAILIES)

  const lines = [`Lo que quiere la persona: "${request}"`]
  if (answers.length) {
    lines.push('Lo que contestó:')
    for (const a of answers) lines.push(`- ${a.question} → ${a.answer}`)
  }
  if (feedback && previous.length) {
    lines.push('Tu propuesta anterior era:')
    for (const d of previous as Array<Record<string, unknown>>) {
      const repeat = toRepeatFromInput(d?.repeat)
      lines.push(`- ${text(d.title, 200)} (${repeat ? describeRepeat(repeat) : 'todos los días'})`)
    }
    lines.push(
      `La persona quiere este cambio: "${feedback}". Haz una propuesta nueva con ese cambio.`
    )
  }

  try {
    const settings = await loadSettings()
    const { value } = await askAgent(dailies, 'plan', { personality: settings.dipPersonality }, [
      { role: 'user', content: lines.join('\n') }
    ])
    return { ok: true, dailies: value }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// A repeat sent back by the interface (for "Cambiar"), only to describe it to Dip.
function toRepeatFromInput(value: unknown): DailyRepeat | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  if (r.kind === 'every-day') return { kind: 'every-day' }
  if (r.kind === 'weekdays' && Array.isArray(r.days)) {
    const days = r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    return days.length ? { kind: 'weekdays', days } : null
  }
  if (r.kind === 'every-n' && Number.isInteger(r.n) && (r.n as number) >= 2) {
    return { kind: 'every-n', n: r.n as number, start: isoDate(new Date()) }
  }
  return null
}
