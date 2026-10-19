import { BrowserWindow } from 'electron'
import type {
  AIAgentsInfo,
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
import { agentLogPath, logAttempt } from './agentLog'
import { AGENTS, dip } from './agents'
import type { AgentDefinition, TaskContext, TaskOutput } from './agents/types'
import {
  type AgentAIConfig,
  customServer,
  DEFAULTS,
  envGeminiKey,
  envServerKey,
  resolveAgentConfig
} from './config'
import { createGeminiProvider } from './gemini'
import { anyServerUp, createCustomServerProvider, type CustomServerConfig } from './customServer'
import * as keyStore from './keyStore'
import { createOllamaProvider, currentOllamaModel, listOllamaModels } from './ollama'
import { AIError, type AIProvider } from './provider'
import { type Candidate, runAgent } from './runAgent'

// Keys and the user's own server can also come from the environment (.env), which wins.
export const geminiKey = async (): Promise<string | null> =>
  envGeminiKey() ?? (await keyStore.geminiKey.load())
const serverKey = async (): Promise<string | null> =>
  envServerKey() ?? (await keyStore.serverKey.load())

export async function customConfig(settings?: Settings): Promise<CustomServerConfig | null> {
  const custom = customServer((settings ?? (await loadSettings())).ai.custom)
  return custom ? { ...custom, key: await serverKey() } : null
}

// A provider set to one model (the agent's). '' = the provider's own default.
function providerFor(backend: AIBackend, model: string): AIProvider {
  if (backend === 'gemini') {
    return createGeminiProvider(geminiKey, async () => model || DEFAULTS.models.gemini)
  }
  if (backend === 'ollama') return createOllamaProvider(async () => model || undefined)
  return createCustomServerProvider(async () => {
    const config = await customConfig()
    return config && { ...config, model: model || config.model }
  })
}

let envFile: string | null = null

// Called at startup with the .env that was loaded (shown in Ajustes).
export function setEnvFile(file: string | null): void {
  envFile = file
}

const isBackend = (value: unknown): value is AIBackend =>
  value === 'gemini' || value === 'ollama' || value === 'custom'

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

function pickActive(
  config: AgentAIConfig,
  available: Record<AIBackend, boolean>
): AIBackend | null {
  const choice = config.provider.value
  if (choice !== 'auto') return available[choice] ? choice : null
  // auto: the first available one, in the user's order.
  return config.order.value.find((b) => available[b]) ?? null
}

export async function refreshStatus(): Promise<AIStatus> {
  const settings = await loadSettings()
  const [key, models, custom, customKey] = await Promise.all([
    geminiKey(),
    listOllamaModels().catch(() => []),
    customConfig(settings).then(anyServerUp),
    serverKey()
  ])
  const available = { gemini: Boolean(key), ollama: models.length > 0, custom }
  const next: AIStatus = {
    active: pickActive(resolveAgentConfig('dip', settings), available),
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

// Which providers an agent tries, in order. In auto mode, if one fails the next one is
// tried: the order, skipping what isn't set up, and leaving for last what was down at the
// last check (so a sleeping server doesn't make every answer wait).
async function candidates(config: AgentAIConfig, settings: Settings): Promise<Candidate[]> {
  const choice = config.provider.value
  let backends: AIBackend[] = [choice === 'auto' ? 'gemini' : choice]
  if (choice === 'auto') {
    const setUp: Record<AIBackend, boolean> = {
      gemini: Boolean(await geminiKey()),
      ollama: true,
      custom: Boolean(customServer(settings.ai.custom))
    }
    const order = config.order.value.filter((b) => setUp[b])
    backends = [...order.filter((b) => status[b]), ...order.filter((b) => !status[b])]
  }
  return backends.map((backend) => {
    const model = config.models[backend].value
    return { backend, model, provider: providerFor(backend, model) }
  })
}

// Demo of self-correction, for showing it in class: with
// NUGGIT_DEMO_BREAK_FIRST_ANSWER=tenderizer (agents separated by commas), that agent's first
// answer is cut in half, so it gets the error back and fixes it. Marked "demo" in the log.
function breaksOnPurpose(agent: string): boolean {
  const names = process.env['NUGGIT_DEMO_BREAK_FIRST_ANSWER'] ?? ''
  return names.split(',').some((name) => name.trim().toLowerCase() === agent)
}

function breakFirstAnswer(provider: AIProvider): AIProvider {
  let broken = false
  return {
    ...provider,
    async chat(messages, opts) {
      const answer = await provider.chat(messages, opts)
      if (broken) return answer
      broken = true
      return answer.slice(0, Math.floor(answer.length / 2))
    }
  }
}

// Runs one task of an agent (SPEC 8.1): its provider and model from the configuration, its
// answer checked, and the errors sent back to it to fix (runAgent). Every try is logged.
export async function askAgent<A extends AgentDefinition, K extends keyof A['tasks'] & string>(
  agent: A,
  taskName: K,
  ctx: TaskContext<A['tasks'][K]>,
  messages: AIMessage[]
): Promise<{ value: TaskOutput<A['tasks'][K]>; backend: AIBackend }> {
  const task = agent.tasks[taskName]
  const settings = await loadSettings()
  const config = resolveAgentConfig(agent.name, settings)
  let list = await candidates(config, settings)
  const demo = breaksOnPurpose(agent.name)
  if (demo) list = list.map((c) => ({ ...c, provider: breakFirstAnswer(c.provider) }))
  try {
    const result = await runAgent({
      agent: agent.name,
      task: taskName,
      messages: [{ role: 'system', content: task.system(ctx) }, ...messages],
      schema: task.jsonSchema,
      check: (raw) => task.check(raw, ctx),
      candidates: list,
      maxRetries: config.maxRetries,
      log: (attempt) => logAttempt(demo ? { ...attempt, demo } : attempt)
    })
    return { value: result.value, backend: result.backend }
  } catch (err) {
    refreshStatus().catch(() => undefined)
    throw err
  }
}

// For Ajustes: what each agent uses and where that comes from.
export async function agentsInfo(): Promise<AIAgentsInfo> {
  const settings = await loadSettings()
  const ollamaFirst = status.ollama ? await currentOllamaModel(undefined).catch(() => '') : ''
  const agents = AGENTS.map((agent) => {
    const config = resolveAgentConfig(agent.name, settings)
    const backend = pickActive(config, status)
    const target =
      backend ?? (config.provider.value === 'auto' ? config.order.value[0] : config.provider.value)
    const model = config.models[target]
    return {
      name: agent.name,
      label: agent.label,
      purpose: agent.purpose,
      provider: config.provider.value,
      providerSource: config.provider.source,
      backend,
      model: model.value || (target === 'ollama' ? ollamaFirst : ''),
      modelSource: model.source
    }
  })
  return { agents, envFile, logFile: agentLogPath() }
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

// Lists the models of what Dip uses now, then makes one tiny call with its model.
export async function testConnection(): Promise<AITestResult> {
  const settings = await loadSettings()
  const config = resolveAgentConfig('dip', settings)
  let firstError: unknown
  for (const { backend, model, provider } of await candidates(config, settings)) {
    try {
      const models = await provider.listModels()
      await provider.chat([{ role: 'user', content: 'Responde solo con la palabra: ok' }])
      await refreshStatus()
      const used = backend === 'ollama' ? await currentOllamaModel(model || undefined) : model
      return { ok: true, backend, models, model: used }
    } catch (err) {
      firstError ??= err
    }
  }
  return {
    ok: false,
    error: errorMessage(firstError ?? new AIError('No hay ninguna IA disponible.'))
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
    const { value, backend } = await askAgent(
      dip,
      'chat',
      { tasks, personality: settings.dipPersonality },
      messages
    )
    return { ok: true, text: value, backend }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

// The "talk to Dip about how it should be" chat in Settings. Nothing is saved here: the
// interface shows the proposal and saves it only if the user approves.
export async function proposePersonality(input: unknown): Promise<AIPersonalityResult> {
  const messages = cleanMessages(input)
  if (!messages) return { ok: false, error: 'Cuéntale a Dip cómo quieres que sea.' }
  try {
    const settings = await loadSettings()
    const { value } = await askAgent(
      dip,
      'personality',
      { current: settings.dipPersonality },
      messages
    )
    return {
      ok: true,
      reply: value.reply,
      personality: value.personality.slice(0, MAX_PERSONALITY)
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
