import { BrowserWindow } from 'electron'
import type { QotdDay, QotdState } from '../shared/types'
import { readJson, writeJson } from './storage/jsonStore'

// Fase 11: your answers to the questions of the day, in qotd.json by card: "2026-10-31"
// (the general question) or "2026-10-31:historia" (a topic's). The question itself comes
// from the date (src/shared/qotd.ts); only "Otra" and answers are saved.

const MAX_ANSWER = 2000
const MAX_TEXT = 300
const MAX_SKIPS = 99
const KEY = /^\d{4}-\d{2}-\d{2}(:[a-z0-9-]{1,30})?$/

let days: QotdState = {}
let loaded = false

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanDay(value: unknown): QotdDay | null {
  if (!isObject(value)) return null
  const day: QotdDay = {
    skip: Number.isInteger(value.skip) ? Math.min(Math.max(value.skip as number, 0), MAX_SKIPS) : 0
  }
  if (typeof value.question === 'string') day.question = value.question.slice(0, MAX_TEXT)
  if (typeof value.kind === 'string') day.kind = value.kind.slice(0, 20)
  if (typeof value.answer === 'string') day.answer = value.answer.slice(0, MAX_ANSWER)
  if (typeof value.answeredAt === 'string') day.answeredAt = value.answeredAt
  return day
}

function commit(next: QotdState): void {
  days = next
  if (loaded) {
    writeJson('qotd', { version: 1, days: next }).catch((err) =>
      console.error('[qotd] could not save', err)
    )
  }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('qotd:changed', next)
}

export async function initQotd(): Promise<void> {
  const data = await readJson<unknown>('qotd', null)
  const saved = isObject(data) && isObject(data.days) ? data.days : {}
  days = {}
  for (const [key, value] of Object.entries(saved)) {
    const day = cleanDay(value)
    if (KEY.test(key) && day) days[key] = day
  }
  loaded = true
}

export function getQotd(): QotdState {
  return days
}

// An empty answer clears it (and you can press "Otra" again).
export function answerQotd(key: unknown, entry: unknown): void {
  if (typeof key !== 'string' || !KEY.test(key) || !isObject(entry)) return
  const { question, kind, answer } = entry
  if (typeof question !== 'string' || typeof answer !== 'string') return
  const current = days[key] ?? { skip: 0 }
  const text = answer.slice(0, MAX_ANSWER)
  if (!text.trim()) {
    const { skip } = current
    commit({ ...days, [key]: { skip } })
    return
  }
  if (text === current.answer && question === current.question) return
  commit({
    ...days,
    [key]: {
      skip: current.skip,
      question: question.slice(0, MAX_TEXT),
      kind: typeof kind === 'string' ? kind.slice(0, 20) : undefined,
      answer: text,
      answeredAt: new Date().toISOString()
    }
  })
}

export function skipQotd(key: unknown): void {
  if (typeof key !== 'string' || !KEY.test(key)) return
  const current = days[key] ?? { skip: 0 }
  if (current.answer?.trim() || current.skip >= MAX_SKIPS) return
  commit({ ...days, [key]: { ...current, skip: current.skip + 1 } })
}
