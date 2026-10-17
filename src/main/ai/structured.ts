import { loadSettings } from '../storage'
import { dipBase } from './dip'
import { withFallback } from './index'
import { AIError } from './provider'

// Asking Dip for an answer in JSON (Tenders, Dailies...). Every answer is checked before use.

export const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

// Reads the JSON object in a model's answer, even if it came wrapped in extra text.
export function parseObject(raw: string): Record<string, unknown> {
  try {
    const data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    if (typeof data === 'object' && data !== null) return data as Record<string, unknown>
  } catch {
    // falls through
  }
  throw new AIError('Dip se enredó con la respuesta. ¿Lo intentas otra vez?')
}

// Dip (with the user's personality) answers one request with JSON following the schema.
export async function askJson(
  instructions: string,
  request: string,
  schema: object
): Promise<string> {
  const settings = await loadSettings()
  const system = dipBase(settings.dipPersonality, [instructions])
  const { value } = await withFallback(settings, (provider) =>
    provider.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: request }
      ],
      { schema: schema as Record<string, unknown> }
    )
  )
  return value
}
