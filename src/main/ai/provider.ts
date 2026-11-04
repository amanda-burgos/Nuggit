import { t } from '../../shared/i18n'
import type { AIMessage, AIModelOption } from '../../shared/types'

export interface ChatOptions {
  json?: boolean // answer with JSON
  schema?: Record<string, unknown> // JSON schema the answer must follow (implies json)
  // Tokens of this call, for agents.log (null when the provider doesn't say).
  onUsage?(usage: ChatUsage): void
  // Cancels the call (and frees a server that answers one request at a time).
  signal?: AbortSignal
}

export interface ChatUsage {
  model: string // the one that answered (for the price)
  tokensIn: number | null
  tokensOut: number | null // includes thinking, which is billed as output
}

export interface AIProvider {
  id: string
  isConfigured(): Promise<boolean>
  chat(messages: AIMessage[], opts?: ChatOptions): Promise<string>
  // Models this key can use for chat, to pick from in Settings.
  listModels(): Promise<AIModelOption[]>
}

// An error whose message can be shown as is (in Spanish, without technical details).
export class AIError extends Error {}

export const CANCELLED = (): string => t('Se canceló la petición.', 'The request was cancelled.')

// The call's own timeout, plus the caller's cancel signal if there is one.
export function withSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([timeout, signal]) : timeout
}
