import type { AIMessage, AIModelOption, CustomServerSettings } from '../../shared/types'
import { AIError, type AIProvider, CANCELLED, type ChatOptions, withSignal } from './provider'
import { t } from '../../shared/i18n'

// The user's own server that speaks the OpenAI API (/v1/chat/completions), with backups.
// Its addresses come from Ajustes (settings.json): none are written here. These servers
// usually answer one request at a time, so each one gets a single try before the next.

const LIST_TIMEOUT_MS = 5_000
const PING_TIMEOUT_MS = 3_000
// A busy server makes you wait: give up sooner on one with a backup after it.
const CHAT_TIMEOUT_MS = 60_000
const LAST_CHAT_TIMEOUT_MS = 120_000

const UNREACHABLE = (): string =>
  t('No llego al servidor. ¿Está Tailscale prendido?', "I can't reach the server. Is Tailscale on?")

export interface CustomServerConfig extends CustomServerSettings {
  key: string | null
}

// Why one server failed. Every server gets its one try either way; this only picks which
// message to show if none of them works.
type Failure = { kind: 'unreachable' | 'busy' | 'request'; error: AIError }

function headers(key: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {})
  }
}

function isNetworkError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message} ${String(err.cause)}` : ''
  return /fetch failed|network|econnrefused|enotfound|ehostunreach|enetunreach|econnreset|socket|timeout|abort/i.test(
    text
  )
}

function failureFor(status: number, model: string): Failure {
  if (status === 401 || status === 403) {
    return {
      kind: 'request',
      error: new AIError(
        t(
          'El servidor no aceptó la key. Revísala en Ajustes 🔑',
          "The server didn't accept the key. Check it in Settings 🔑"
        )
      )
    }
  }
  if (status === 404) {
    return {
      kind: 'request',
      error: new AIError(
        t(
          `El servidor no tiene el modelo "${model}" (o la URL no termina en /v1).`,
          `The server doesn't have the model "${model}" (or the URL doesn't end in /v1).`
        )
      )
    }
  }
  // 429 / 5xx: busy or broken right now; a backup may do better.
  return {
    kind: 'busy',
    error: new AIError(
      t(
        'El servidor está ocupado o tuvo un problema. Intenta en un momento.',
        'The server is busy or had a problem. Try again in a moment.'
      )
    )
  }
}

// Only the answer itself: "content". Never "reasoning_content" (the model's thinking), and
// without <think> blocks in case a server puts the thinking inside the content.
export function answerText(data: unknown): string {
  const message = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message
  const content = message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              typeof part === 'object' &&
              part !== null &&
              (part as { type?: unknown }).type === 'text'
                ? String((part as { text?: unknown }).text ?? '')
                : ''
            )
            .join('')
        : ''
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '') // a closing tag whose opening was left out
    .trim()
}

async function post(
  url: string,
  body: unknown,
  key: string | null,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(body),
    signal: withSignal(timeoutMs, signal)
  })
}

// One try on one server. A server that refuses the JSON schema option (400) is asked once
// more without it: the prompt already asks for JSON, and every answer is checked anyway.
async function chatOnce(
  baseUrl: string,
  config: CustomServerConfig,
  messages: AIMessage[],
  opts: ChatOptions | undefined,
  timeoutMs: number
): Promise<string | Failure> {
  const body = { model: config.model, messages, stream: false }
  const format = opts?.schema
    ? { type: 'json_schema', json_schema: { name: 'answer', schema: opts.schema } }
    : opts?.json
      ? { type: 'json_object' }
      : undefined
  try {
    let response = await post(
      `${baseUrl}/chat/completions`,
      format ? { ...body, response_format: format } : body,
      config.key,
      timeoutMs,
      opts?.signal
    )
    if (response.status === 400 && format) {
      response = await post(
        `${baseUrl}/chat/completions`,
        body,
        config.key,
        timeoutMs,
        opts?.signal
      )
    }
    if (!response.ok) {
      console.warn(
        `[ai] server ${response.status}:`,
        (await response.text().catch(() => '')).slice(0, 300)
      )
      return failureFor(response.status, config.model)
    }
    const data = await response.json()
    const usage = (data as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } })
      ?.usage
    opts?.onUsage?.({
      model: config.model,
      tokensIn: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
      tokensOut: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null
    })
    const text = answerText(data)
    if (!text) {
      return {
        kind: 'request',
        error: new AIError(
          t(
            'El servidor no contestó nada. Intenta decirlo de otra forma.',
            "The server didn't answer anything. Try saying it another way."
          )
        )
      }
    }
    return text
  } catch (err) {
    if (isNetworkError(err)) return { kind: 'unreachable', error: new AIError(UNREACHABLE()) }
    console.error('[ai] unexpected server error', err)
    return {
      kind: 'busy',
      error: new AIError(
        t(
          'Algo salió mal al hablar con el servidor.',
          'Something went wrong talking to the server.'
        )
      )
    }
  }
}

async function getJson(url: string, key: string | null, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    headers: headers(key),
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok)
    throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
  return response.json()
}

// True if any of the servers answers (checked in order, stops at the first that does).
export async function anyServerUp(config: CustomServerConfig | null): Promise<boolean> {
  for (const baseUrl of config?.servers ?? []) {
    try {
      await getJson(`${baseUrl}/models`, config!.key, PING_TIMEOUT_MS)
      return true
    } catch {
      // try the next one
    }
  }
  return false
}

export function createCustomServerProvider(
  getConfig: () => Promise<CustomServerConfig | null>
): AIProvider {
  async function config(): Promise<CustomServerConfig> {
    const c = await getConfig()
    if (!c || c.servers.length === 0) {
      throw new AIError(
        t(
          'Todavía no hay un servidor propio. Agrégalo en Ajustes.',
          "There's no server of your own yet. Add it in Settings."
        )
      )
    }
    return c
  }

  return {
    id: 'custom',

    isConfigured: async () => Boolean((await getConfig())?.servers.length),

    // The main server first; if it doesn't answer (or is busy), the backups in order.
    async chat(messages: AIMessage[], opts?: ChatOptions): Promise<string> {
      const c = await config()
      let failure: Failure | null = null
      for (const [i, baseUrl] of c.servers.entries()) {
        // Cancelled: don't go on to the backups either.
        if (opts?.signal?.aborted) throw new AIError(CANCELLED())
        const last = i === c.servers.length - 1
        const result = await chatOnce(
          baseUrl,
          c,
          messages,
          opts,
          last ? LAST_CHAT_TIMEOUT_MS : CHAT_TIMEOUT_MS
        )
        if (typeof result === 'string') return result
        if (opts?.signal?.aborted) throw new AIError(CANCELLED())
        // Keep the most telling reason: a real answer from a server beats "unreachable".
        if (!failure || failure.kind === 'unreachable') failure = result
      }
      throw failure!.error
    },

    async listModels(): Promise<AIModelOption[]> {
      const c = await config()
      for (const baseUrl of c.servers) {
        try {
          const data = (await getJson(`${baseUrl}/models`, c.key, LIST_TIMEOUT_MS)) as {
            data?: Array<{ id?: unknown }>
          }
          return (data.data ?? [])
            .map((m) => (typeof m.id === 'string' ? m.id : ''))
            .filter(Boolean)
            .sort()
            .map((id) => ({ id, label: id }))
        } catch {
          // try the next one
        }
      }
      throw new AIError(UNREACHABLE())
    }
  }
}
