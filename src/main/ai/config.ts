import { existsSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import type { AIBackend, CustomServerSettings, Settings, SttBackend } from '../../shared/types'
import rawDefaults from '../../../config/ai.defaults.json'

// SPEC 8.1: which provider and model each agent uses, without touching code. Priority:
// environment variables (and .env) > Ajustes (settings.json) > config/ai.defaults.json.
// Everything here is a plain function of (env, settings, defaults), so it can be tested.

export type AgentName = 'dip' | 'tenderizer' | 'dailies' | 'actions' | 'brainDump'
export const AGENT_NAMES: AgentName[] = ['dip', 'tenderizer', 'dailies', 'actions', 'brainDump']

export type ConfigSource = 'env' | 'settings' | 'default'
export interface Sourced<T> {
  value: T
  source: ConfigSource
}

export interface AgentAIConfig {
  provider: Sourced<'auto' | AIBackend>
  order: Sourced<AIBackend[]>
  // '' = the provider picks (Ollama: the first installed model).
  models: Record<AIBackend, Sourced<string>>
  maxRetries: number
}

export type Env = Record<string, string | undefined>

// "openaiCompatible" is what the user's own server is called outside the code.
const providerName = z
  .enum(['gemini', 'ollama', 'openaiCompatible', 'custom'])
  .transform((p): AIBackend => (p === 'openaiCompatible' ? 'custom' : p))
// Speech to text for the call mode (SPEC 9.10): whisper.cpp here, or a provider.
const sttName = z
  .enum(['whisper', 'openaiCompatible', 'custom', 'gemini'])
  .transform((p): SttBackend => (p === 'openaiCompatible' ? 'custom' : p))
const agentDefaults = z.object({ provider: providerName.optional(), model: z.string().optional() })

const DefaultsSchema = z.object({
  provider: z.union([z.literal('auto'), providerName]),
  order: z.array(providerName).min(1),
  models: z.object({ gemini: z.string(), ollama: z.string(), openaiCompatible: z.string() }),
  ollamaUrl: z.url(),
  maxRetries: z.number().int().min(0).max(5),
  // Dollars per million tokens, by Gemini model, for the cost in logs/agents.log.
  geminiPricesPerMillionTokens: z.record(
    z.string(),
    z.union([z.string(), z.object({ input: z.number().min(0), output: z.number().min(0) })])
  ),
  agents: z.record(z.string(), agentDefaults),
  stt: z.object({
    provider: z.union([z.literal('auto'), sttName]),
    order: z.array(sttName).min(1),
    whisperModel: z.enum(['base', 'small']),
    openaiModel: z.string(),
    geminiModel: z.string()
  })
})
export type AIDefaults = z.infer<typeof DefaultsSchema>

// A broken defaults file is a bug in the repo: better to fail loudly at startup.
export const DEFAULTS: AIDefaults = DefaultsSchema.parse(rawDefaults)

const BACKENDS: AIBackend[] = ['gemini', 'ollama', 'custom']

const get = (env: Env, name: string): string | undefined => env[name]?.trim() || undefined

function parseProvider(value: string | undefined): 'auto' | AIBackend | undefined {
  if (!value) return undefined
  if (value.toLowerCase() === 'auto') return 'auto'
  const parsed = providerName.safeParse(value)
  if (parsed.success) return parsed.data
  console.warn(`[ai] unknown provider "${value}" in the environment, ignored`)
  return undefined
}

function parseOrder(value: string | undefined): AIBackend[] | undefined {
  if (!value) return undefined
  const order = [
    ...new Set(
      value
        .split(',')
        .map((p) => parseProvider(p.trim()))
        .filter((p): p is AIBackend => p !== undefined && p !== 'auto')
    )
  ]
  return order.length ? order : undefined
}

function first<T>(...options: Array<[T | undefined, ConfigSource]>): Sourced<T> {
  for (const [value, source] of options) if (value !== undefined) return { value, source }
  throw new Error('no value') // the last option is always a default
}

const ENV_MODEL: Record<AIBackend, string> = {
  gemini: 'NUGGIT_GEMINI_MODEL',
  ollama: 'NUGGIT_OLLAMA_MODEL',
  custom: 'NUGGIT_OPENAI_MODEL'
}

function settingsModel(settings: Settings, backend: AIBackend): string | undefined {
  const model =
    backend === 'gemini'
      ? settings.ai.model
      : backend === 'ollama'
        ? settings.ai.ollamaModel
        : settings.ai.custom?.model
  return model || undefined
}

export function resolveAgentConfig(
  agent: AgentName,
  settings: Settings,
  env: Env = process.env,
  defaults: AIDefaults = DEFAULTS
): AgentAIConfig {
  const prefix = `NUGGIT_AGENT_${agent.toUpperCase()}_`
  const ownDefaults = defaults.agents[agent] ?? {}
  const saved = settings.ai.provider
  const provider = first<'auto' | AIBackend>(
    [parseProvider(get(env, `${prefix}PROVIDER`)), 'env'],
    [parseProvider(get(env, 'NUGGIT_AI_PROVIDER')), 'env'],
    [saved === 'none' ? undefined : saved, 'settings'],
    [ownDefaults.provider, 'default'],
    [defaults.provider, 'default']
  )
  const order = first<AIBackend[]>(
    [parseOrder(get(env, 'NUGGIT_AI_ORDER')), 'env'],
    [settings.ai.order?.length ? settings.ai.order : undefined, 'settings'],
    [defaults.order, 'default']
  )
  // NUGGIT_AI_MODEL (and the agent's own) is for the provider the agent uses; in auto mode,
  // for the first one of the order.
  const target = provider.value === 'auto' ? order.value[0] : provider.value
  const models = Object.fromEntries(
    BACKENDS.map((backend) => {
      const mine = backend === target
      return [
        backend,
        first<string>(
          [mine ? get(env, `${prefix}MODEL`) : undefined, 'env'],
          [mine ? get(env, 'NUGGIT_AI_MODEL') : undefined, 'env'],
          [get(env, ENV_MODEL[backend]), 'env'],
          [settingsModel(settings, backend), 'settings'],
          [mine ? ownDefaults.model : undefined, 'default'],
          [defaults.models[backend === 'custom' ? 'openaiCompatible' : backend], 'default']
        )
      ]
    })
  ) as Record<AIBackend, Sourced<string>>
  return { provider, order, models, maxRetries: defaults.maxRetries }
}

// Estimated dollars of one call, for logs/agents.log. Ollama and the user's own server are
// free; Gemini uses the price table, and is null for a model not in it or without tokens.
export function estimateCostUsd(
  backend: AIBackend,
  usage: { model: string; tokensIn: number | null; tokensOut: number | null },
  defaults: AIDefaults = DEFAULTS
): number | null {
  if (backend !== 'gemini') return 0
  const price = defaults.geminiPricesPerMillionTokens[usage.model]
  if (typeof price !== 'object' || usage.tokensIn === null || usage.tokensOut === null) return null
  return (usage.tokensIn * price.input + usage.tokensOut * price.output) / 1_000_000
}

export function ollamaUrl(env: Env = process.env, defaults: AIDefaults = DEFAULTS): string {
  return (get(env, 'NUGGIT_OLLAMA_URL') ?? defaults.ollamaUrl).replace(/\/+$/, '')
}

export function envGeminiKey(env: Env = process.env): string | undefined {
  return get(env, 'GEMINI_API_KEY')
}

export function envServerKey(env: Env = process.env): string | undefined {
  return get(env, 'NUGGIT_OPENAI_API_KEY')
}

// The user's own server, with the addresses from the environment taking over those saved in
// Ajustes. The model is resolved per agent, like the others.
export function customServer(
  saved: CustomServerSettings | undefined,
  env: Env = process.env
): CustomServerSettings | undefined {
  const servers = get(env, 'NUGGIT_OPENAI_BASE_URLS')
    ?.split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter((url) => /^https?:\/\//.test(url))
  if (!servers?.length) return saved
  return { name: saved?.name || 'Servidor (.env)', model: saved?.model ?? '', servers }
}

// Loads the first .env found in these folders. Variables already set in the real
// environment are kept (process.loadEnvFile never overwrites them).
export function loadDotEnv(folders: string[]): string | null {
  for (const folder of folders) {
    const file = join(folder, '.env')
    if (!existsSync(file)) continue
    try {
      process.loadEnvFile(file)
      return file
    } catch (err) {
      console.error(`[ai] could not read ${file}`, err)
    }
  }
  return null
}

// --- Speech to text (call mode) ---

export interface SttConfig {
  provider: Sourced<'auto' | SttBackend>
  order: SttBackend[]
  whisperBin: string | undefined // from NUGGIT_WHISPER_BIN; else looked for on disk
  whisperModel: Sourced<'base' | 'small'>
  whisperModelPath: string | undefined // NUGGIT_WHISPER_MODEL: a model file of your own
  openaiModel: string
  geminiModel: string
}

function parseStt(value: string | undefined): 'auto' | SttBackend | undefined {
  if (!value) return undefined
  if (value.toLowerCase() === 'auto') return 'auto'
  const parsed = sttName.safeParse(value)
  if (parsed.success) return parsed.data
  console.warn(`[stt] unknown provider "${value}" in the environment, ignored`)
  return undefined
}

export function resolveSttConfig(
  settings: Settings,
  env: Env = process.env,
  defaults: AIDefaults = DEFAULTS
): SttConfig {
  const saved = settings.voice.stt
  const model = settings.voice.whisperModel
  return {
    provider: first<'auto' | SttBackend>(
      [parseStt(get(env, 'NUGGIT_STT_PROVIDER')), 'env'],
      [saved, 'settings'],
      [defaults.stt.provider, 'default']
    ),
    order: defaults.stt.order,
    whisperBin: get(env, 'NUGGIT_WHISPER_BIN'),
    whisperModel: first<'base' | 'small'>(
      [model, 'settings'],
      [defaults.stt.whisperModel, 'default']
    ),
    whisperModelPath: get(env, 'NUGGIT_WHISPER_MODEL'),
    openaiModel: get(env, 'NUGGIT_STT_MODEL') ?? defaults.stt.openaiModel,
    geminiModel: get(env, 'NUGGIT_STT_GEMINI_MODEL') ?? defaults.stt.geminiModel
  }
}
