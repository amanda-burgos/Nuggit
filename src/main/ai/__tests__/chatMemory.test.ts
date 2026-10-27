import { describe, expect, it } from 'vitest'
import { dip } from '../agents/dip'
import { EMPTY_MEMORY, MAX_SENT, messagesToSend, nextBlock, unsummarized } from '../chatMemory'

const chat = (n: number): Array<{ id: string }> =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}` }))
const ids = (messages: Array<{ id: string }> | null): string[] | null =>
  messages?.map((m) => m.id) ?? null

describe('chatMemory', () => {
  it('sends everything while the chat is short', () => {
    expect(ids(messagesToSend(chat(11), EMPTY_MEMORY))).toHaveLength(11)
    expect(nextBlock(chat(11), EMPTY_MEMORY)).toBeNull()
  })

  it('summarizes the first 6 once 12 are waiting, so the last 6 stay in full', () => {
    expect(ids(nextBlock(chat(12), EMPTY_MEMORY))).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'])
  })

  it('after a summary, sends only what it does not cover (6 to 11 messages)', () => {
    const memory = { summary: 'La persona se llama Ana.', upTo: 'm6' }
    expect(ids(messagesToSend(chat(12), memory))).toEqual(['m7', 'm8', 'm9', 'm10', 'm11', 'm12'])
    expect(messagesToSend(chat(17), memory)).toHaveLength(11)
    expect(nextBlock(chat(17), memory)).toBeNull()
    expect(ids(nextBlock(chat(18), memory))).toEqual(['m7', 'm8', 'm9', 'm10', 'm11', 'm12'])
  })

  it('treats every message as new if the summarized one is gone', () => {
    expect(unsummarized(chat(3), { summary: 'x', upTo: 'old' })).toHaveLength(3)
  })

  it('caps what is sent if summarizing keeps failing', () => {
    expect(messagesToSend(chat(50), EMPTY_MEMORY)).toHaveLength(MAX_SENT)
  })
})

describe('the summary task', () => {
  const check = dip.tasks.summary.check

  it('accepts up to 100 words', () => {
    expect(check(Array(100).fill('palabra').join(' '))).toEqual({
      ok: true,
      value: Array(100).fill('palabra').join(' ')
    })
  })

  it('sends a longer one back to be shortened', () => {
    const result = check(Array(130).fill('palabra').join(' '))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('130 palabras')
  })
})
