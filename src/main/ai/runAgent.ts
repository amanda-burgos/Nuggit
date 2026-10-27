import type { AIBackend, AIMessage } from '../../shared/types'
import { AIError, type AIProvider, CANCELLED, type ChatUsage } from './provider'

// SPEC 8.1, self-correction: one loop for every agent. It calls the model, checks the
// answer, and when the check fails it sends the agent its own answer plus the exact error
// so it can fix it. Up to maxRetries fixes per provider, then the next provider of auto
// mode; if all fail, a kind message. Nothing here knows about Electron (it is tested).

export type CheckResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface Candidate {
  backend: AIBackend
  model: string // for the log; '' = the provider's default
  provider: AIProvider
}

export interface AgentAttempt {
  at: string
  agent: string
  task: string
  provider: AIBackend
  model: string
  attempt: number // 1 = first try, 2+ = after sending the error back
  result: 'ok' | 'invalid' | 'error'
  error?: string // without the user's data
  corrected?: boolean // true when an answer passed after one or more fixes
  demo?: boolean // the answer was broken on purpose (NUGGIT_DEMO_BREAK_FIRST_ANSWER)
  tokensIn: number | null // null when the provider doesn't say
  tokensOut: number | null
  ms: number // how long the call to the model took
  costUsd: number | null // estimated; null when the price is unknown
}

export interface RunAgentOptions<T> {
  agent: string
  task: string
  messages: AIMessage[] // system prompt + conversation
  schema?: Record<string, unknown> // ask for JSON following this schema
  check(raw: string): CheckResult<T>
  candidates: Candidate[]
  maxRetries: number
  log?(attempt: AgentAttempt): void
  // Estimated dollars of one call; without it, every call costs null.
  price?(backend: AIBackend, usage: ChatUsage): number | null
  // Stops everything (no more fixes, no other provider) and throws CANCELLED.
  signal?: AbortSignal
}

export interface RunAgentResult<T> {
  value: T
  backend: AIBackend
  model: string
  attempts: number // on that provider
}

export const NO_AI = 'No hay ninguna IA disponible ahora. Revisa Ajustes → IA de Dip.'
export const TANGLED = 'Dip se enredó con la respuesta. ¿Lo intentas otra vez?'

export function correctionMessage(error: string, json: boolean): string {
  return json
    ? `Tu respuesta falló porque: ${error}\nCorrígela y responde solo con JSON válido según el schema.`
    : `Tu respuesta falló porque: ${error}\nCorrígela y responde otra vez.`
}

// Quoted text may be the user's or the model's words: the log only keeps the shape.
export function redact(error: string): string {
  return error
    .replace(/"[^"\n]*"/g, '"…"')
    .replace(/'[^'\n]*'/g, "'…'")
    .replace(/«[^»\n]*»/g, '«…»')
    .slice(0, 500)
}

export async function runAgent<T>(opts: RunAgentOptions<T>): Promise<RunAgentResult<T>> {
  const errors: unknown[] = []
  const log = (entry: Omit<AgentAttempt, 'at' | 'agent' | 'task'>): void =>
    opts.log?.({ at: new Date().toISOString(), agent: opts.agent, task: opts.task, ...entry })

  for (const { backend, model, provider } of opts.candidates) {
    let messages = opts.messages
    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      if (opts.signal?.aborted) throw new AIError(CANCELLED)
      let raw: string
      let usage: ChatUsage = { model, tokensIn: null, tokensOut: null }
      const started = Date.now()
      let ms = 0
      const metrics = (): Pick<AgentAttempt, 'tokensIn' | 'tokensOut' | 'ms' | 'costUsd'> => ({
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        ms,
        costUsd: opts.price?.(backend, usage) ?? null
      })
      try {
        raw = await provider.chat(messages, {
          ...(opts.schema ? { schema: opts.schema } : {}),
          ...(opts.signal ? { signal: opts.signal } : {}),
          onUsage: (u) => (usage = u)
        })
        ms = Date.now() - started
      } catch (err) {
        ms = Date.now() - started
        // The provider itself failed (down, no key...): fixing the answer won't help.
        log({
          provider: backend,
          model,
          attempt,
          result: 'error',
          error: redact(describe(err)),
          ...metrics()
        })
        if (opts.signal?.aborted) throw new AIError(CANCELLED)
        errors.push(err)
        break
      }
      const checked = opts.check(raw)
      if (checked.ok) {
        log({
          provider: backend,
          model,
          attempt,
          result: 'ok',
          corrected: attempt > 1,
          ...metrics()
        })
        return { value: checked.value, backend, model, attempts: attempt }
      }
      log({
        provider: backend,
        model,
        attempt,
        result: 'invalid',
        error: redact(checked.error),
        ...metrics()
      })
      if (attempt > opts.maxRetries) {
        errors.push(new AIError(TANGLED))
        break
      }
      messages = [
        ...messages,
        { role: 'assistant', content: raw },
        { role: 'user', content: correctionMessage(checked.error, Boolean(opts.schema)) }
      ]
    }
  }
  // The first error is the most useful: it is about the provider Dip wanted to use.
  throw errors[0] ?? new AIError(NO_AI)
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
