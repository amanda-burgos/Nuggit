import type { AIMessage, AIModelOption } from '../../shared/types'

export interface ChatOptions {
  json?: boolean // answer with JSON
  schema?: Record<string, unknown> // JSON schema the answer must follow (implies json)
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
