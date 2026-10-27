import { beforeEach, describe, expect, it, vi } from 'vitest'

// dipChat with Electron, the disk and the AI replaced: only the order of the calls matters.
const ai = vi.hoisted(() => ({
  chats: [] as Array<{ messages: unknown[]; summary?: string }>,
  summaries: [] as Array<{ signal: AbortSignal; finish(text: string): void }>,
  saved: [] as unknown[]
}))

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../ai', () => ({ errorMessage: (err: unknown) => String(err) }))
vi.mock('../storage/jsonStore', () => ({
  readJson: async () => null,
  writeJson: async (_name: string, data: unknown) => void ai.saved.push(data)
}))
vi.mock('../nextAction', () => ({ getNextActionState: () => ({}) }))
vi.mock('../tasks', () => ({ getTasks: () => [] }))
vi.mock('../ai/actions', () => ({
  chatWithActions: async (messages: unknown[], opts: { summary?: string }) => {
    ai.chats.push({ messages, summary: opts.summary })
    return { text: `respuesta ${ai.chats.length}`, backend: 'custom' }
  },
  summarizeChat: (_previous: string, _block: unknown[], signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      ai.summaries.push({ signal, finish: resolve })
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    })
}))

const { clearDipChat, initDipChat, sendToDip } = await import('../dipChat')

async function exchanges(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await sendToDip(`mensaje ${i + 1}`)
}

describe('Dip chat memory', () => {
  beforeEach(async () => {
    await initDipChat()
    clearDipChat()
    ai.chats.length = 0
    ai.summaries.length = 0
  })

  it('summarizes in the background once 12 messages are waiting', async () => {
    await exchanges(5) // 10 messages: nothing to summarize yet
    expect(ai.summaries).toHaveLength(0)
    await exchanges(1) // 12
    expect(ai.summaries).toHaveLength(1)
    ai.summaries[0].finish('La persona se llama Ana.')
    await vi.waitFor(() => expect(JSON.stringify(ai.saved.at(-1))).toContain('Ana'))
    await exchanges(1)
    const last = ai.chats.at(-1)!
    expect(last.summary).toBe('La persona se llama Ana.')
    expect(last.messages).toHaveLength(7) // 13 messages, 6 of them in the summary
  })

  it('cancels a summary in progress so the person’s message goes first, then tries again', async () => {
    await exchanges(6)
    const first = ai.summaries[0]
    const sent = sendToDip('¿cómo me llamo?')
    expect(first.signal.aborted).toBe(true) // before Dip is even asked
    await sent
    expect(ai.chats.at(-1)!.summary).toBe('') // nothing lost: all messages still go in full
    expect(ai.chats.at(-1)!.messages).toHaveLength(13)
    expect(ai.summaries).toHaveLength(2) // tried again after the answer
    expect(ai.summaries[1].signal.aborted).toBe(false)
  })
})
