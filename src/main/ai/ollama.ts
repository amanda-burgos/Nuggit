import type { AIMessage, AIModelOption } from '../../shared/types'
import { ollamaUrl } from './config'
import { AIError, type AIProvider, type ChatOptions, withSignal } from './provider'
import { t } from '../../shared/i18n'

// Ollama runs models on this computer: no account, no key, nothing leaves the Mac.
// It listens on ollamaUrl() (config/ai.defaults.json or NUGGIT_OLLAMA_URL) once it is open.
const LIST_TIMEOUT_MS = 5_000
// The first answer can be slow while Ollama loads the model into memory.
const CHAT_TIMEOUT_MS = 180_000
// Models that turn text into numbers (for search), not for chatting.
const NOT_FOR_CHAT = /embed/i

export const SUGGESTED_OLLAMA_MODEL = 'llama3.2'

function friendlyError(err: unknown): AIError {
  if (err instanceof AIError) return err
  const text = err instanceof Error ? `${err.name} ${err.message} ${String(err.cause)}` : ''
  if (/timeout|abort/i.test(text)) {
    return new AIError(
      t(
        'Ollama tardó demasiado en contestar. Intenta otra vez o usa un modelo más pequeño.',
        'Ollama took too long to answer. Try again or use a smaller model.'
      )
    )
  }
  if (/fetch failed|econnrefused|network/i.test(text)) {
    return new AIError(
      t(
        'Ollama no está abierto. Ábrelo (o instálalo desde ollama.com) y vuelve a intentar.',
        "Ollama isn't open. Open it (or install it from ollama.com) and try again."
      )
    )
  }
  console.error('[ai] unexpected Ollama error', err)
  return new AIError(
    t(
      'Algo salió mal al hablar con Ollama. Intenta otra vez.',
      'Something went wrong talking to Ollama. Try again.'
    )
  )
}

async function request<T>(
  path: string,
  timeoutMs: number,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${ollamaUrl()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: withSignal(timeoutMs, signal)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw Object.assign(new Error(`Ollama ${response.status}: ${detail}`), {
      status: response.status
    })
  }
  return (await response.json()) as T
}

export async function listOllamaModels(): Promise<AIModelOption[]> {
  try {
    const data = await request<{ models?: Array<{ name?: string }> }>('/api/tags', LIST_TIMEOUT_MS)
    return (data.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => Boolean(name) && !NOT_FOR_CHAT.test(name!))
      .sort()
      .map((name) => ({ id: name, label: name }))
  } catch (err) {
    throw friendlyError(err)
  }
}

// getModel returns the chosen model, or undefined to use the first installed one.
export function createOllamaProvider(getModel: () => Promise<string | undefined>): AIProvider {
  async function resolveModel(): Promise<string> {
    const chosen = await getModel()
    if (chosen) return chosen
    const [first] = await listOllamaModels()
    if (!first) {
      throw new AIError(
        t(
          `Ollama está abierto pero no tiene modelos. Baja uno en la Terminal con: ollama pull ${SUGGESTED_OLLAMA_MODEL}`,
          `Ollama is open but has no models. Download one in Terminal with: ollama pull ${SUGGESTED_OLLAMA_MODEL}`
        )
      )
    }
    return first.id
  }

  return {
    id: 'ollama',

    isConfigured: async () => (await listOllamaModels().catch(() => [])).length > 0,

    async chat(messages: AIMessage[], opts?: ChatOptions): Promise<string> {
      const model = await resolveModel()
      try {
        const data = await request<{
          message?: { content?: string }
          prompt_eval_count?: number
          eval_count?: number
        }>(
          '/api/chat',
          CHAT_TIMEOUT_MS,
          {
            model,
            messages,
            stream: false,
            ...(opts?.schema ? { format: opts.schema } : opts?.json ? { format: 'json' } : {})
          },
          opts?.signal
        )
        opts?.onUsage?.({
          model,
          tokensIn: data.prompt_eval_count ?? null,
          tokensOut: data.eval_count ?? null
        })
        const text = data.message?.content?.trim()
        if (!text)
          throw new AIError(
            t(
              'Ollama no contestó nada. Intenta decirlo de otra forma.',
              "Ollama didn't answer anything. Try saying it another way."
            )
          )
        return text
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          throw new AIError(
            t(
              `El modelo "${model}" no está instalado. Instálalo en la Terminal con: ollama pull ${model}`,
              `The model "${model}" isn't installed. Install it in Terminal with: ollama pull ${model}`
            )
          )
        }
        throw friendlyError(err)
      }
    },

    listModels: listOllamaModels
  }
}

// Which model a test or chat would use, for showing it in Settings.
export async function currentOllamaModel(chosen: string | undefined): Promise<string> {
  if (chosen) return chosen
  const [first] = await listOllamaModels()
  return first?.id ?? SUGGESTED_OLLAMA_MODEL
}
