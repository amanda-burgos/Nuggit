import { describe, expect, it } from 'vitest'
import type { AIBackend, AIMessage, Task } from '../../../shared/types'
import { actions, type ActionsReply } from '../agents/actions'
import { tenderizer, type TenderPlan } from '../agents/tenderizer'
import { AIError, type AIProvider, CANCELLED } from '../provider'
import {
  type AgentAttempt,
  type Candidate,
  runAgent,
  type RunAgentResult,
  TANGLED
} from '../runAgent'

// A fake provider: answers from a list, one per call, and remembers what it was sent.
function fakeProvider(answers: Array<string | Error>): AIProvider & { calls: AIMessage[][] } {
  const calls: AIMessage[][] = []
  return {
    id: 'fake',
    calls,
    isConfigured: async () => true,
    listModels: async () => [],
    async chat(messages) {
      calls.push(messages)
      const next = answers[calls.length - 1]
      if (next === undefined) throw new Error('the fake provider ran out of answers')
      if (next instanceof Error) throw next
      return next
    }
  }
}

const candidate = (provider: AIProvider, backend: AIBackend = 'ollama'): Candidate => ({
  backend,
  model: 'fake-model',
  provider
})

const VALID_PLAN = JSON.stringify({
  title: 'Proyecto de ciencias',
  dueDate: '',
  steps: [
    { title: 'Buscar el tema', minutes: 5 },
    { title: 'Escribir la intro', minutes: 20 }
  ]
})

function runTenderizer(
  candidates: Candidate[],
  log?: (a: AgentAttempt) => void
): Promise<RunAgentResult<TenderPlan>> {
  const task = tenderizer.tasks.plan
  return runAgent({
    agent: 'tenderizer',
    task: 'plan',
    messages: [
      { role: 'system', content: task.system({}) },
      { role: 'user', content: 'Tarea grande: "proyecto de ciencias"' }
    ],
    schema: task.jsonSchema,
    check: (raw) => task.check(raw),
    candidates,
    maxRetries: 2,
    log
  })
}

describe('runAgent', () => {
  it('returns a valid answer on the first try', async () => {
    const provider = fakeProvider([VALID_PLAN])
    const result = await runTenderizer([candidate(provider)])
    expect(result.attempts).toBe(1)
    expect(result.value.steps).toHaveLength(2)
    expect(provider.calls).toHaveLength(1)
  })

  it('sends invalid JSON back to the agent with the exact error, and it fixes it', async () => {
    const provider = fakeProvider(['{"title": "Proyecto", "steps": [', VALID_PLAN])
    const log: AgentAttempt[] = []
    const result = await runTenderizer([candidate(provider)], (a) => log.push(a))

    expect(result.attempts).toBe(2)
    expect(result.value.title).toBe('Proyecto de ciencias')
    // The second call carries the bad answer and the reason it failed.
    const retry = provider.calls[1]
    expect(retry.at(-2)).toEqual({ role: 'assistant', content: '{"title": "Proyecto", "steps": [' })
    expect(retry.at(-1)?.content).toMatch(/^Tu respuesta falló porque: no es JSON válido/)
    expect(retry.at(-1)?.content).toContain('responde solo con JSON válido según el schema')
    expect(log.map((a) => [a.attempt, a.result, a.corrected])).toEqual([
      [1, 'invalid', undefined],
      [2, 'ok', true]
    ])
  })

  it('explains schema errors field by field', async () => {
    const wrong = JSON.stringify({ title: 'x', dueDate: 'mañana', steps: [] })
    const provider = fakeProvider([wrong, VALID_PLAN])
    await runTenderizer([candidate(provider)])
    const feedback = provider.calls[1].at(-1)?.content ?? ''
    expect(feedback).toContain('dueDate')
    expect(feedback).toContain('AAAA-MM-DD')
    expect(feedback).toContain('al menos un paso')
  })

  it('gives up on a provider after 2 retries and moves to the next one', async () => {
    const broken = fakeProvider(['nope', 'still nope', 'nope again'])
    const backup = fakeProvider([VALID_PLAN])
    const log: AgentAttempt[] = []
    const result = await runTenderizer(
      [candidate(broken, 'custom'), candidate(backup, 'gemini')],
      (a) => log.push(a)
    )
    expect(broken.calls).toHaveLength(3) // 1 try + 2 retries
    expect(result.backend).toBe('gemini')
    expect(log.map((a) => `${a.provider}#${a.attempt}:${a.result}`)).toEqual([
      'custom#1:invalid',
      'custom#2:invalid',
      'custom#3:invalid',
      'gemini#1:ok'
    ])
  })

  it('does not retry a provider that is down: it goes to the next one', async () => {
    const down = fakeProvider([new AIError('Ollama no está abierto.')])
    const backup = fakeProvider([VALID_PLAN])
    const result = await runTenderizer([candidate(down), candidate(backup, 'gemini')])
    expect(down.calls).toHaveLength(1)
    expect(result.backend).toBe('gemini')
  })

  it('ends with a kind message when every provider fails', async () => {
    const provider = fakeProvider(['a', 'b', 'c'])
    await expect(runTenderizer([candidate(provider)])).rejects.toThrow(TANGLED)
    await expect(runTenderizer([])).rejects.toThrow(/ninguna IA/)
  })

  it('logs tokens, time and cost of every try', async () => {
    const provider: AIProvider = {
      ...fakeProvider([]),
      async chat(_messages, opts) {
        opts?.onUsage?.({ model: 'fake-model', tokensIn: 1000, tokensOut: 200 })
        return VALID_PLAN
      }
    }
    const log: AgentAttempt[] = []
    await runAgent({
      agent: 'tenderizer',
      task: 'plan',
      messages: [{ role: 'user', content: 'hola' }],
      check: (raw) => tenderizer.tasks.plan.check(raw),
      candidates: [candidate(provider, 'gemini')],
      maxRetries: 0,
      log: (a) => log.push(a),
      price: (_backend, usage) => (usage.tokensIn! + usage.tokensOut!) / 1_000_000
    })
    expect(log[0]).toMatchObject({ tokensIn: 1000, tokensOut: 200, costUsd: 0.0012 })
    expect(log[0].ms).toBeGreaterThanOrEqual(0)
  })

  it('logs null tokens when the provider doesn’t say them', async () => {
    const log: AgentAttempt[] = []
    await runTenderizer([candidate(fakeProvider([VALID_PLAN]))], (a) => log.push(a))
    expect(log[0]).toMatchObject({ tokensIn: null, tokensOut: null, costUsd: null })
  })

  it('stops at once when cancelled, without trying other providers', async () => {
    const controller = new AbortController()
    const slow: AIProvider = {
      ...fakeProvider([]),
      chat: (_messages, opts) =>
        new Promise((_resolve, reject) =>
          opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        )
    }
    const backup = fakeProvider([VALID_PLAN])
    const run = runAgent({
      agent: 'tenderizer',
      task: 'plan',
      messages: [{ role: 'user', content: 'hola' }],
      check: (raw) => tenderizer.tasks.plan.check(raw),
      candidates: [candidate(slow, 'custom'), candidate(backup)],
      maxRetries: 2,
      signal: controller.signal
    })
    controller.abort()
    await expect(run).rejects.toThrow(CANCELLED)
    expect(backup.calls).toHaveLength(0)
  })

  it('keeps the user’s words out of the log', async () => {
    const wrong = JSON.stringify({ title: 'x', dueDate: '', steps: [{ title: 'y', minutes: '5' }] })
    const provider = fakeProvider(['Mi tarea "secreta" no es JSON', wrong, VALID_PLAN])
    const log: AgentAttempt[] = []
    await runTenderizer([candidate(provider)], (a) => log.push(a))
    expect(JSON.stringify(log)).not.toContain('secreta')
  })
})

describe('actions agent', () => {
  const task = (id: string, title: string): Task =>
    ({ id, title, status: 'todo', priority: 'medium', order: 0 }) as Task
  const tasks = [task('t1', 'Tarea de mate'), task('t2', 'Lavar la ropa')]

  function runActions(
    answers: string[],
    userText: string
  ): { provider: ReturnType<typeof fakeProvider>; result: Promise<RunAgentResult<ActionsReply>> } {
    const provider = fakeProvider(answers)
    const ctx = { tasks, shareTasks: false, nextAction: '', userText }
    const reply = actions.tasks.reply
    return {
      provider,
      result: runAgent({
        agent: 'actions',
        task: 'reply',
        messages: [{ role: 'user', content: userText }],
        schema: reply.jsonSchema,
        check: (raw) => reply.check(raw, ctx),
        candidates: [candidate(provider)],
        maxRetries: 2
      })
    }
  }

  const answer = (type: string, taskName: string, reply = 'ok'): string =>
    JSON.stringify({
      reply,
      action: { type, task: taskName, title: '', dueDate: '', priority: '' }
    })

  it('finds the task Dip names', async () => {
    const { result } = runActions([answer('complete', 'mate')], 'listo con eso')
    expect((await result).value.action).toEqual({
      type: 'complete',
      taskId: 't1',
      taskTitle: 'Tarea de mate'
    })
  })

  it('tells Dip when the task does not exist, and Dip asks instead', async () => {
    const { provider, result } = runActions(
      [answer('complete', 'historia'), answer('none', '', '¿Cuál tarea terminaste?')],
      'ya está'
    )
    const value = (await result).value
    expect(value.action).toBeUndefined()
    expect(value.text).toBe('¿Cuál tarea terminaste?')
    expect(provider.calls[1].at(-1)?.content).toContain(
      'no existe una tarea pendiente que se llame "historia"'
    )
  })
})
