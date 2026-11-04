import { describe, expect, it } from 'vitest'
import {
  customTopic,
  customTopicId,
  findTopic,
  keyDate,
  keyTopic,
  makeQotd,
  qotdForDip,
  qotdKey,
  questionOfDay,
  topicQuestion
} from './qotd'
import { setLang } from './i18n'

describe('questionOfDay', () => {
  it('gives the same question for the same day, and another with "Otra"', () => {
    expect(questionOfDay('2026-10-31')).toEqual(questionOfDay('2026-10-31'))
    const asked = new Set([0, 1, 2, 3].map((skip) => questionOfDay('2026-10-31', skip).text))
    expect(asked.size).toBeGreaterThan(1)
  })

  it('mixes bank questions and ones made by code over a month', () => {
    const ids = Array.from({ length: 30 }, (_, i) => {
      const date = `2026-11-${String(i + 1).padStart(2, '0')}`
      return questionOfDay(date).id
    })
    expect(ids.some((id) => id.startsWith('b:'))).toBe(true)
    expect(ids.some((id) => !id.startsWith('b:'))).toBe(true)
  })

  it('makes "¿Qué prefieres?" and template questions', () => {
    const qotd = makeQotd({
      questions: [],
      prefieres: [['playa', 'montaña'], ['pizza']],
      templates: [{ kind: 'imagina', text: '¿Cuál es {x}?', fill: ['tu olor favorito'] }]
    })
    const texts = new Set([0, 1, 2, 3, 4, 5].map((s) => qotd('2026-10-31', s).text))
    expect(texts).toEqual(
      new Set(['¿Qué prefieres: playa o montaña?', '¿Cuál es tu olor favorito?'])
    )
  })

  it('does not repeat a bank question on consecutive days', () => {
    const qotd = makeQotd({
      questions: [
        { kind: 'pensar', text: 'A' },
        { kind: 'pensar', text: 'B' },
        { kind: 'pensar', text: 'C' }
      ],
      prefieres: [[]],
      templates: []
    })
    const days = ['2026-10-29', '2026-10-30', '2026-10-31'].map((d) => qotd(d).text)
    expect(new Set(days).size).toBe(3)
  })
})

describe('topicQuestion', () => {
  const topic = { id: 'historia', icon: '🏛️', label: 'Historia', questions: ['A', 'B', 'C', 'D'] }

  it('gives one question a day without repeats until the topic is used up', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']
    const asked = days.map((d) => topicQuestion(topic, d)?.text)
    expect(new Set(asked).size).toBe(4)
    expect(topicQuestion(topic, '2026-11-01', 1)?.text).toBe(asked[1])
  })

  it('has nothing for an empty topic', () => {
    expect(topicQuestion({ ...topic, questions: [] }, '2026-11-01')).toBeNull()
  })

  it('saves each card under its own key', () => {
    expect(qotdKey('2026-11-01')).toBe('2026-11-01')
    expect(qotdKey('2026-11-01', 'historia')).toBe('2026-11-01:historia')
    expect(keyDate('2026-11-01:historia')).toBe('2026-11-01')
    expect(keyTopic('2026-11-01:historia')).toBe('historia')
    expect(keyTopic('2026-11-01')).toBeUndefined()
  })
})

describe('customTopic', () => {
  it('makes questions about a topic you write, with an emoji as its icon', () => {
    const plain = customTopic({ id: 'mi-k-pop', label: 'K-pop' })
    expect(plain.icon).toBe('⭐')
    expect(plain.questions.length).toBeGreaterThan(5)
    expect(plain.questions.every((q) => q.includes('K-pop'))).toBe(true)
    const withEmoji = customTopic({ id: 'mi-quimica', label: '🧪 Química' })
    expect(withEmoji.icon).toBe('🧪')
    expect(withEmoji.label).toBe('Química')
  })

  it('never asks two of your topics the same thing on the same day', () => {
    const [a, b] = [
      customTopic({ id: 'mi-k-pop', label: 'K-pop' }, 0),
      customTopic({ id: 'mi-quimica', label: 'Química' }, 1)
    ]
    for (const date of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      const qa = topicQuestion(a, date)?.text.replace('K-pop', '')
      const qb = topicQuestion(b, date)?.text.replace('Química', '')
      expect(qa).not.toBe(qb)
    }
  })

  it('gives each topic its own id', () => {
    expect(customTopicId('Química Orgánica', [])).toBe('mi-quimica-organica')
    expect(customTopicId('K-pop', ['mi-k-pop'])).toBe('mi-k-pop-2')
    expect(customTopicId('🎸', [])).toBe('mi-tema')
  })
})

describe('qotdForDip', () => {
  it('includes the answer when there is one', () => {
    expect(qotdForDip('¿Playa o montaña?', 'playa')).toContain('Mi respuesta: playa')
    expect(qotdForDip('¿Playa o montaña?', '  ')).not.toContain('Mi respuesta')
    expect(qotdForDip('¿Quién?', '', 'Historia')).toContain('Pregunta del día de Historia')
  })
})

describe('in English', () => {
  it('uses the English bank and texts, with the same topic ids', () => {
    setLang('en')
    try {
      expect(questionOfDay('2026-10-31').text).not.toMatch(/[¿áéíóúñ]/)
      const qotd = makeQotd({
        questions: [],
        prefieres: [['go to the beach', 'go to the mountains']],
        templates: []
      })
      expect(qotd('2026-10-31').text).toBe(
        'Would you rather go to the beach or go to the mountains?'
      )
      expect(customTopic({ id: 'mi-k-pop', label: 'K-pop' }).questions[0]).toContain('K-pop')
      expect(findTopic('historia')?.label).toBe('History')
      expect(qotdForDip('Beach or mountains?', 'beach')).toContain('My answer: beach')
    } finally {
      setLang('es')
    }
  })
})
