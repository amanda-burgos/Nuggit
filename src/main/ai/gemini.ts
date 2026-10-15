import { ApiError, GoogleGenAI } from '@google/genai'
import type { AIMessage, AIModelOption } from '../../shared/types'
import { AIError, type AIProvider, type ChatOptions } from './provider'

// Google keeps this alias pointed at its current Flash model, which the free tier includes.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

const TIMEOUT_MS = 30_000
// Models that can chat but are not meant for it (images, speech, embeddings...).
const NOT_FOR_CHAT = /image|tts|audio|live|embedding|robotics|computer-use|veo|imagen/i

// Turns any SDK or network error into something kind to show the user.
function friendlyError(err: unknown, model: string): AIError {
  if (err instanceof AIError) return err
  if (err instanceof ApiError) {
    const text = err.message.toLowerCase()
    if (text.includes('api key') || text.includes('api_key') || [401, 403].includes(err.status)) {
      return new AIError('Esa key no funciona. Revisa que la copiaste completa 🔑')
    }
    if (err.status === 404) {
      return new AIError(`El modelo "${model}" no está disponible. Elige otro en Ajustes.`)
    }
    if (err.status === 429) {
      return new AIError(
        'Dip necesita un respiro: se acabaron las preguntas gratis por ahora. Intenta en un rato.'
      )
    }
    if (err.status >= 500) {
      return new AIError('Gemini está teniendo problemas. Intenta otra vez en un momento.')
    }
  }
  const text = err instanceof Error ? `${err.name} ${err.message}`.toLowerCase() : ''
  if (text.includes('abort') || text.includes('timeout')) {
    return new AIError('Gemini tardó demasiado en contestar. Intenta otra vez.')
  }
  if (text.includes('fetch') || text.includes('network') || text.includes('enotfound')) {
    return new AIError('No pude conectarme. ¿Hay internet? 📡')
  }
  console.error('[ai] unexpected error', err)
  return new AIError('Algo salió mal al hablar con Gemini. Intenta otra vez.')
}

export function createGeminiProvider(
  getKey: () => Promise<string | null>,
  getModel: () => Promise<string>
): AIProvider {
  async function client(): Promise<GoogleGenAI> {
    const apiKey = await getKey()
    if (!apiKey) throw new AIError('Todavía no hay una key de Gemini guardada.')
    return new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } })
  }

  return {
    id: 'gemini',

    isConfigured: async () => Boolean(await getKey()),

    async chat(messages: AIMessage[], opts?: ChatOptions): Promise<string> {
      const model = await getModel()
      try {
        const ai = await client()
        const system = messages.filter((m) => m.role === 'system').map((m) => m.content)
        const response = await ai.models.generateContent({
          model,
          contents: messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
          config: {
            ...(system.length ? { systemInstruction: system.join('\n\n') } : {}),
            ...(opts?.json || opts?.schema ? { responseMimeType: 'application/json' } : {}),
            ...(opts?.schema ? { responseJsonSchema: opts.schema } : {})
          }
        })
        const text = response.text?.trim()
        if (!text) throw new AIError('Gemini no contestó nada. Intenta decirlo de otra forma.')
        return text
      } catch (err) {
        throw friendlyError(err, model)
      }
    },

    async listModels(): Promise<AIModelOption[]> {
      try {
        const ai = await client()
        const models: AIModelOption[] = []
        for await (const m of await ai.models.list()) {
          const id = m.name?.replace(/^models\//, '')
          if (!id || !id.startsWith('gemini') || NOT_FOR_CHAT.test(id)) continue
          if (!m.supportedActions?.includes('generateContent')) continue
          models.push({ id, label: m.displayName || id })
        }
        return models.sort((a, b) => a.id.localeCompare(b.id))
      } catch (err) {
        throw friendlyError(err, await getModel())
      }
    }
  }
}
