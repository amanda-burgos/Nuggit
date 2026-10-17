import { BrowserWindow } from 'electron'
import type {
  AIBackend,
  AIChatResult,
  AIMessage,
  AIPersonalityResult,
  AISaveKeyResult,
  AIStatus,
  AITestResult,
  Settings
} from '../../shared/types'
import { changeAIProvider } from '../settings'
import { loadSettings, MAX_PERSONALITY, setAIProvider } from '../storage'
import { getTasks } from '../tasks'
import { dipInstructions, PERSONALITY_SCHEMA, personalityInstructions } from './dip'
import { createGeminiProvider, DEFAULT_GEMINI_MODEL } from './gemini'
import { anyServerUp, createCustomServerProvider, type CustomServerConfig } from './customServer'
import * as keyStore from './keyStore'
import { createOllamaProvider, currentOllamaModel, listOllamaModels } from './ollama'
import { AIError, type AIProvider } from './provider'

async function customConfig(settings?: Settings): Promise<CustomServerConfig | null> {
  const custom = (settings ?? (await loadSettings())).ai.custom
  return custom ? { ...custom, key: await keyStore.serverKey.load() } : null
}

const providers: Record<AIBackend, AIProvider> = {
  gemini: createGeminiProvider(keyStore.geminiKey.load, async () => {
    const settings = await loadSettings()
    return settings.ai.model || DEFAULT_GEMINI_MODEL
  }),
  ollama: createOllamaProvider(async () => (await loadSettings()).ai.ollamaModel),
  custom: createCustomServerProvider(() => customConfig())
}

// The order "auto" tries them in, unless the user chose another in Ajustes.
const DEFAULT_ORDER: AIBackend[] = ['gemini', 'ollama', 'custom']
const isBackend = (value: unknown): value is AIBackend =>
  value === 'gemini' || value === 'ollama' || value === 'custom'

function autoOrder(settings: Settings): AIBackend[] {
  return settings.ai.order?.length ? settings.ai.order : DEFAULT_ORDER
}

const MAX_MESSAGES = 30
const MAX_MESSAGE_LENGTH = 4000
// How often to check whether Ollama was opened or closed.
const STATUS_INTERVAL_MS = 10_000

export function errorMessage(err: unknown): string {
  return err instanceof AIError ? err.message : 'Algo salió mal. Intenta otra vez.'
}

// --- What Dip can use right now ---

let status: AIStatus = {
  active: null,
  gemini: false,
  ollama: false,
  custom: false,
  customKey: false
}

function pickActive(settings: Settings, available: Record<AIBackend, boolean>): AIBackend | null {
  const choice = settings.ai.provider
  if (isBackend(choice)) return available[choice] ? choice : null
  // auto: the first available one, in the user's order.
  return autoOrder(settings).find((b) => available[b]) ?? null
}

export async function refreshStatus(): Promise<AIStatus> {
  const settings = await loadSettings()
  const [key, models, custom, customKey] = await Promise.all([
    keyStore.geminiKey.load(),
    listOllamaModels().catch(() => []),
    customConfig(settings).then(anyServerUp),
    keyStore.serverKey.load()
  ])
  const available = { gemini: Boolean(key), ollama: models.length > 0, custom }
  const next: AIStatus = {
    active: pickActive(settings, available),
    ...available,
    customKey: Boolean(customKey)
  }
  if (JSON.stringify(next) !== JSON.stringify(status)) {
    status = next
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('ai:status', status)
  }
  return status
}

export function getStatus(): AIStatus {
  return status
}

// Which providers to try, in order. In auto mode, if one fails the next one is tried: the
// user's order, skipping what isn't set up, and leaving for last what was down at the
// last check (so a sleeping server doesn't make every answer wait).
async function candidates(settings: Settings): Promise<AIBackend[]> {
  const choice = settings.ai.provider
  if (isBackend(choice)) return [choice]
  const setUp: Record<AIBackend, boolean> = {
    gemini: Boolean(await keyStore.geminiKey.load()),
    ollama: true,
    custom: Boolean(settings.ai.custom)
  }
  const order = autoOrder(settings).filter((b) => setUp[b])
  return [...order.filter((b) => status[b]), ...order.filter((b) => !status[b])]
}

export async function withFallback<T>(
  settings: Settings,
  run: (provider: AIProvider, backend: AIBackend) => Promise<T>
): Promise<{ value: T; backend: AIBackend }> {
  const errors: unknown[] = []
  for (const backend of await candidates(settings)) {
    try {
      return { value: await run(providers[backend], backend), backend }
    } catch (err) {
      errors.push(err)
    }
  }
  refreshStatus().catch(() => undefined)
  // The first error is the most useful: it is about the provider Dip wanted to use.
  throw errors[0]
}

// Keeps settings.ai.provider valid. Runs at startup, before any window or the menu bar
// exist, so it only touches the saved file. Then keeps the status up to date.
export async function initAI(): Promise<void> {
  const settings = await loadSettings()
  if (!['gemini', 'ollama', 'custom', 'auto'].includes(settings.ai.provider)) {
    await setAIProvider('auto')
  }
  await refreshStatus()
  setInterval(() => refreshStatus().catch(() => undefined), STATUS_INTERVAL_MS)
}

export async function setProvider(input: unknown): Promise<void> {
  if (input === 'auto' || isBackend(input)) {
    await changeAIProvider(input)
    await refreshStatus()
  }
}

// --- Gemini key ---

export async function saveKey(input: unknown): Promise<AISaveKeyResult> {
  const key = typeof input === 'string' ? input.trim() : ''
  if (!/^\S{10,200}$/.test(key)) {
    return { ok: false, error: 'Eso no parece una key de Gemini. Cópiala completa, sin espacios.' }
  }
  if (!keyStore.canEncrypt()) {
    return {
      ok: false,
      error: 'Este equipo no permite guardar la key cifrada, así que no la guardé.'
    }
  }
  try {
    await keyStore.geminiKey.save(key)
    await refreshStatus()
    return { ok: true }
  } catch (err) {
    console.error('[ai] could not save the key', err)
    return { ok: false, error: 'No pude guardar la key. Intenta otra vez.' }
  }
}

export async function removeKey(): Promise<void> {
  await keyStore.geminiKey.remove()
  await refreshStatus()
}

// --- The user's own server: its optional key ---

export async function saveServerKey(input: unknown): Promise<AISaveKeyResult> {
  const key = typeof input === 'string' ? input.trim() : ''
  if (!/^\S{1,500}$/.test(key)) return { ok: false, error: 'Pega la key completa, sin espacios.' }
  if (!keyStore.canEncrypt()) {
    return {
      ok: false,
      error: 'Este equipo no permite guardar la key cifrada, así que no la guardé.'
    }
  }
  try {
    await keyStore.serverKey.save(key)
    await refreshStatus()
    return { ok: true }
  } catch (err) {
    console.error('[ai] could not save the server key', err)
    return { ok: false, error: 'No pude guardar la key. Intenta otra vez.' }
  }
}

export async function removeServerKey(): Promise<void> {
  await keyStore.serverKey.remove()
  await refreshStatus()
}

// --- Using the AI ---

// Lists the models of what Dip uses now, then makes one tiny call with the chosen one.
export async function testConnection(): Promise<AITestResult> {
  try {
    const settings = await loadSettings()
    const { value, backend } = await withFallback(settings, async (provider, backend) => {
      const models = await provider.listModels()
      await provider.chat([{ role: 'user', content: 'Responde solo con la palabra: ok' }])
      const model =
        backend === 'ollama'
          ? await currentOllamaModel(settings.ai.ollamaModel)
          : backend === 'custom'
            ? (settings.ai.custom?.model ?? '')
            : settings.ai.model || DEFAULT_GEMINI_MODEL
      return { models, model }
    })
    await refreshStatus()
    return { ok: true, backend, ...value }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

function isChatMessage(value: unknown): value is AIMessage {
  if (typeof value !== 'object' || value === null) return false
  const { role, content } = value as Record<string, unknown>
  return (role === 'user' || role === 'assistant') && typeof content === 'string'
}

// Only user/assistant messages from the interface, trimmed; must end with the user's turn.
function cleanMessages(input: unknown): AIMessage[] | null {
  const messages = (Array.isArray(input) ? input : [])
    .filter(isChatMessage)
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return null
  return messages
}

// Chat with Dip. Dip's instructions and (with permission) the pending tasks are added here.
export async function chat(input: unknown): Promise<AIChatResult> {
  const messages = cleanMessages(input)
  if (!messages) return { ok: false, error: 'No hay nada que preguntar todavía.' }
  try {
    const settings = await loadSettings()
    const tasks = settings.ai.shareTasksWithAI ? getTasks() : null
    const system = dipInstructions(tasks, settings.dipPersonality)
    const { value, backend } = await withFallback(settings, (provider) =>
      provider.chat([{ role: 'system', content: system }, ...messages])
    )
    return { ok: true, text: value, backend }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// Reads {"reply", "personality"} from the model, even if it wrapped it in extra text.
function parsePersonality(text: string): { reply: string; personality: string } {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const data = JSON.parse(json) as Record<string, unknown>
    const reply = typeof data.reply === 'string' ? data.reply.trim() : ''
    const personality = typeof data.personality === 'string' ? data.personality.trim() : ''
    if (reply && personality) {
      return { reply, personality: personality.slice(0, MAX_PERSONALITY) }
    }
  } catch {
    // falls through to the friendly error
  }
  throw new AIError('Dip se enredó al escribir su nueva personalidad. ¿Lo intentas otra vez?')
}

// The "talk to Dip about how it should be" chat in Settings. Nothing is saved here: the
// interface shows the proposal and saves it only if the user approves.
export async function proposePersonality(input: unknown): Promise<AIPersonalityResult> {
  const messages = cleanMessages(input)
  if (!messages) return { ok: false, error: 'Cuéntale a Dip cómo quieres que sea.' }
  try {
    const settings = await loadSettings()
    const system = personalityInstructions(settings.dipPersonality)
    const { value } = await withFallback(settings, async (provider) =>
      parsePersonality(
        await provider.chat([{ role: 'system', content: system }, ...messages], {
          schema: PERSONALITY_SCHEMA
        })
      )
    )
    return { ok: true, ...value }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
