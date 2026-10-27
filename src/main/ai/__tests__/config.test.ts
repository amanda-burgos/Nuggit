import { describe, expect, it } from 'vitest'
import type { Settings } from '../../../shared/types'
import { customServer, DEFAULTS, estimateCostUsd, ollamaUrl, resolveAgentConfig } from '../config'

const settings = (ai: Partial<Settings['ai']> = {}): Settings =>
  ({ ai: { provider: 'auto', shareTasksWithAI: false, ...ai } }) as Settings

describe('resolveAgentConfig', () => {
  it('uses the defaults file when nothing else is set', () => {
    const config = resolveAgentConfig('dip', settings({ provider: 'none' }), {})
    expect(config.provider).toEqual({ value: 'auto', source: 'default' })
    expect(config.order).toEqual({ value: ['gemini', 'ollama', 'custom'], source: 'default' })
    expect(config.models.gemini).toEqual({ value: DEFAULTS.models.gemini, source: 'default' })
    expect(config.maxRetries).toBe(2)
  })

  it('settings win over the defaults', () => {
    const config = resolveAgentConfig(
      'dip',
      settings({ provider: 'gemini', model: 'gemini-pro', order: ['ollama', 'gemini'] }),
      {}
    )
    expect(config.provider).toEqual({ value: 'gemini', source: 'settings' })
    expect(config.models.gemini).toEqual({ value: 'gemini-pro', source: 'settings' })
    expect(config.order.source).toBe('settings')
  })

  it('the environment wins over settings', () => {
    const config = resolveAgentConfig('dip', settings({ provider: 'gemini', model: 'x' }), {
      NUGGIT_AI_PROVIDER: 'openaiCompatible',
      NUGGIT_AI_MODEL: 'qwen3',
      NUGGIT_AI_ORDER: 'openaiCompatible, ollama,gemini'
    })
    expect(config.provider).toEqual({ value: 'custom', source: 'env' })
    expect(config.models.custom).toEqual({ value: 'qwen3', source: 'env' })
    // NUGGIT_AI_MODEL is only for the chosen provider.
    expect(config.models.gemini).toEqual({ value: 'x', source: 'settings' })
    expect(config.order.value).toEqual(['custom', 'ollama', 'gemini'])
  })

  it('an agent can have its own provider and model', () => {
    const env = {
      NUGGIT_AI_PROVIDER: 'gemini',
      NUGGIT_AGENT_TENDERIZER_PROVIDER: 'ollama',
      NUGGIT_AGENT_TENDERIZER_MODEL: 'llama3.1:8b'
    }
    const tenderizer = resolveAgentConfig('tenderizer', settings(), env)
    expect(tenderizer.provider.value).toBe('ollama')
    expect(tenderizer.models.ollama).toEqual({ value: 'llama3.1:8b', source: 'env' })
    expect(resolveAgentConfig('dip', settings(), env).provider.value).toBe('gemini')
  })

  it('ignores empty and unknown values', () => {
    const config = resolveAgentConfig('dip', settings({ provider: 'ollama' }), {
      NUGGIT_AI_PROVIDER: '',
      NUGGIT_AGENT_DIP_PROVIDER: 'chatgpt'
    })
    expect(config.provider).toEqual({ value: 'ollama', source: 'settings' })
  })
})

describe('environment-only settings', () => {
  it('reads the Ollama address and the user’s servers', () => {
    expect(ollamaUrl({})).toBe(DEFAULTS.ollamaUrl)
    expect(ollamaUrl({ NUGGIT_OLLAMA_URL: 'http://10.0.0.2:11434/' })).toBe('http://10.0.0.2:11434')
    const saved = { name: 'Mío', model: 'm', servers: ['http://a/v1'] }
    expect(customServer(saved, {})).toBe(saved)
    expect(customServer(saved, { NUGGIT_OPENAI_BASE_URLS: 'http://b/v1/, http://c/v1' })).toEqual({
      name: 'Mío',
      model: 'm',
      servers: ['http://b/v1', 'http://c/v1']
    })
  })
})

describe('estimateCostUsd', () => {
  const usage = { model: 'gemini-flash-latest', tokensIn: 1_000_000, tokensOut: 1_000_000 }

  it('is free on Ollama and the own server', () => {
    expect(estimateCostUsd('ollama', usage)).toBe(0)
    expect(estimateCostUsd('custom', usage)).toBe(0)
  })

  it('uses the Gemini price table of the defaults file', () => {
    const { input, output } = DEFAULTS.geminiPricesPerMillionTokens['gemini-flash-latest'] as {
      input: number
      output: number
    }
    expect(estimateCostUsd('gemini', usage)).toBeCloseTo(input + output)
  })

  it('is null for an unknown model or missing tokens', () => {
    expect(estimateCostUsd('gemini', { ...usage, model: 'gemini-otro' })).toBeNull()
    expect(estimateCostUsd('gemini', { ...usage, tokensOut: null })).toBeNull()
  })
})
