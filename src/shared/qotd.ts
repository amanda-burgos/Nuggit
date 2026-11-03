import rawQotd from '../../config/qotd.json'
import type { QotdCustomTopic } from './types'

// Fase 11: the question of the day. A bank of questions (config/qotd.json) plus ones made
// by code ("¿Qué prefieres: X o Y?" and templates). The same date always gives the same
// question, in every window, without saving anything; "Otra" moves to the next one.
// Each topic you like (Matemáticas, Historia…) also has its own question of the day.

export type QotdKind = 'divertida' | 'conocerte' | 'pensar' | 'prefieres' | 'imagina'

export interface QotdQuestion {
  id: string // "b:3" (bank), "p:1-0-2" (prefieres: group, pair), "t:0-4" (template)
  kind: QotdKind
  text: string
}

interface QotdBank {
  questions: Array<{ kind: string; text: string }>
  prefieres: string[][] // groups of options; pairs are only made inside a group
  templates: Array<{ kind: string; text: string; fill: string[] }>
  topics: QotdTopic[]
  customTemplates: string[] // questions for a topic you write yourself; {x} = its name
}

export interface QotdTopic {
  id: string // "matematicas"
  icon: string
  label: string
  questions: string[]
  start?: number // where it starts in its questions; by default, from its id
}

const BANK: QotdBank = rawQotd

// What the general question is made from.
type GeneralBank = Omit<QotdBank, 'topics' | 'customTemplates'>

export const QOTD_KINDS: Record<QotdKind, { icon: string; label: string }> = {
  divertida: { icon: '😄', label: 'Divertida' },
  conocerte: { icon: '🪞', label: 'Para conocerte' },
  pensar: { icon: '💭', label: 'Para pensar' },
  prefieres: { icon: '⚖️', label: '¿Qué prefieres?' },
  imagina: { icon: '✨', label: 'Imagina' }
}

const asKind = (kind: string): QotdKind => (kind in QOTD_KINDS ? (kind as QotdKind) : 'pensar')

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

function bankQuestions(bank: GeneralBank): QotdQuestion[] {
  return bank.questions.map((q, i) => ({ id: `b:${i}`, kind: asKind(q.kind), text: q.text }))
}

// Every pair of options in a group once ("la playa o la montaña", never "montaña o playa"
// too). Only inside a group, so it never asks "¿la montaña o bailar en público?".
function generatedQuestions(bank: GeneralBank): QotdQuestion[] {
  const made: QotdQuestion[] = []
  bank.prefieres.forEach((options, g) => {
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        made.push({
          id: `p:${g}-${i}-${j}`,
          kind: 'prefieres',
          text: `¿Qué prefieres: ${options[i]} o ${options[j]}?`
        })
      }
    }
  })
  bank.templates.forEach((t, i) =>
    t.fill.forEach((fill, j) =>
      made.push({
        id: `t:${i}-${j}`,
        kind: asKind(t.kind),
        text: capitalize(t.text.replace('{x}', fill))
      })
    )
  )
  return made
}

// A small, stable hash (FNV-1a), so a date always lands on the same question.
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Days since 1970 for a "AAAA-MM-DD" date (as a day, not a moment).
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000)
}

// The bank in a fixed shuffled order: consecutive days walk it, so a bank question
// doesn't come back until the whole bank has been used.
function shuffled<T>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, key: hash(`orden:${i}`) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}

export function makeQotd(bank: GeneralBank): (date: string, skip?: number) => QotdQuestion {
  const fromBank = shuffled(bankQuestions(bank))
  const generated = generatedQuestions(bank)
  return (date, skip = 0) => {
    const h = hash(`${date}#${skip}`)
    // About 6 days out of 10 from the bank, the rest made by code.
    const useBank = fromBank.length && (!generated.length || h % 10 < 6)
    if (useBank) return fromBank[(dayNumber(date) + skip) % fromBank.length]
    return generated[h % generated.length]
  }
}

// The question for a date; skip = how many times "Otra" was pressed that day.
export const questionOfDay = makeQotd(BANK)

// The topics you can pick, in the order they show.
export const QOTD_TOPICS: QotdTopic[] = BANK.topics

// A topic you wrote yourself ("K-pop", "🧪 Química"). There are no questions written for
// it, so they come from templates; an emoji at the start becomes its icon.
// position: its place in your list. Your topics share the same templates, so each starts
// 5 further along, and two of them never ask the same thing on the same day.
export function customTopic(custom: QotdCustomTopic, position = 0): QotdTopic {
  const emoji = /^(\p{Extended_Pictographic}\uFE0F?)\s*(.+)$/u.exec(custom.label)
  const label = emoji ? emoji[2] : custom.label
  return {
    id: custom.id,
    icon: emoji ? emoji[1] : '⭐',
    label,
    questions: BANK.customTemplates.map((t) => t.replace('{x}', label)),
    start: position * 5
  }
}

// The built-in topics plus yours.
export const allTopics = (custom: QotdCustomTopic[] = []): QotdTopic[] => [
  ...QOTD_TOPICS,
  ...custom.map((c, i) => customTopic(c, i))
]

export const findTopic = (id: string, custom?: QotdCustomTopic[]): QotdTopic | undefined =>
  allTopics(custom).find((t) => t.id === id)

// Lowercase, no accents: "Química" and "quimica" are the same topic.
export const normalizeTopic = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

// "K-pop" → "mi-k-pop" (with a number if that one is taken).
export function customTopicId(label: string, taken: string[]): string {
  const slug =
    normalizeTopic(label)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'tema'
  let id = `mi-${slug}`
  for (let n = 2; taken.includes(id); n++) id = `mi-${slug}-${n}`
  return id
}

// A topic's question for a date: its questions in a fixed shuffled order, one per day, so
// none comes back until the topic has used them all. Each topic starts at a different spot.
export function topicQuestion(topic: QotdTopic, date: string, skip = 0): QotdQuestion | null {
  if (!topic.questions.length) return null
  const order = shuffled(topic.questions.map((text, i) => ({ text, i })))
  const at =
    (dayNumber(date) + skip + ((topic.start ?? hash(topic.id)) % order.length)) % order.length
  return { id: `${topic.id}:${order[at].i}`, kind: 'pensar', text: order[at].text }
}

// Where a card's answer is saved: "2026-10-31" (the general one) or "2026-10-31:historia".
export const qotdKey = (date: string, topic?: string): string => (topic ? `${date}:${topic}` : date)

export const keyDate = (key: string): string => key.slice(0, 10)
export const keyTopic = (key: string): string | undefined => key.slice(11) || undefined

// What Dip gets when you tap "Platicar con Dip".
export function qotdForDip(question: string, answer?: string, topic?: string): string {
  const said = answer?.trim()
  const title = topic ? `Pregunta del día de ${topic}` : 'Pregunta del día'
  return said
    ? `${title}: "${question}"\nMi respuesta: ${said}\n¿Platicamos de esto?`
    : `${title}: "${question}"\nTodavía no sé qué contestar, ¿platicamos de esto?`
}
