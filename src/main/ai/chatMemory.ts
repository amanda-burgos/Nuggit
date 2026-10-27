// What the Dip chat sends to the AI: a short summary of the old messages plus every message
// the summary doesn't cover yet, in full. The summary moves forward 6 messages at a time,
// always leaving at least the last 6 out of it, so Dip gets between 6 and 11 full messages.
// The history on screen never changes. No Electron here, so it can be tested.

export const SUMMARY_EVERY = 6
export const SUMMARY_MAX_WORDS = 100
// A safety cap in case summarizing keeps failing (then the messages pile up unsummarized).
export const MAX_SENT = 30

export interface ChatMemory {
  summary: string // '' = nothing summarized yet
  upTo: string | null // id of the last message in the summary
}

export const EMPTY_MEMORY: ChatMemory = { summary: '', upTo: null }

// The messages after upTo. If upTo is gone (trimmed from the saved history), they all are.
export function unsummarized<M extends { id: string }>(messages: M[], memory: ChatMemory): M[] {
  const i = memory.upTo ? messages.findIndex((m) => m.id === memory.upTo) : -1
  return messages.slice(i + 1)
}

export function messagesToSend<M extends { id: string }>(messages: M[], memory: ChatMemory): M[] {
  return unsummarized(messages, memory).slice(-MAX_SENT)
}

// The next 6 messages to fold into the summary, once 12 are waiting (so 6 stay in full).
export function nextBlock<M extends { id: string }>(messages: M[], memory: ChatMemory): M[] | null {
  const waiting = unsummarized(messages, memory)
  return waiting.length >= SUMMARY_EVERY * 2 ? waiting.slice(0, SUMMARY_EVERY) : null
}

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length
