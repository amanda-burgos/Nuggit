import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { AgentAttempt } from './runAgent'

// logs/agents.log in the app's data folder: one JSON line per attempt of every agent
// (agent, provider, model, error, whether it got fixed). Never the prompts or answers.
// Writes go one after another; past 1 MB the old log moves to agents.log.old.

const MAX_BYTES = 1_000_000

export const agentLogPath = (): string => join(app.getPath('userData'), 'logs', 'agents.log')

let queue: Promise<void> = Promise.resolve()

async function append(line: string): Promise<void> {
  const file = agentLogPath()
  await fs.mkdir(join(file, '..'), { recursive: true })
  const size = await fs.stat(file).then(
    (s) => s.size,
    () => 0
  )
  if (size > MAX_BYTES) await fs.rename(file, `${file}.old`)
  await fs.appendFile(file, line, { mode: 0o600 })
}

export function logAttempt(attempt: AgentAttempt): void {
  const line = `${JSON.stringify(attempt)}\n`
  if (attempt.result !== 'ok' || attempt.corrected) {
    console.info(
      `[agents] ${attempt.agent}/${attempt.task} ${attempt.provider} #${attempt.attempt} ${attempt.result}`
    )
  }
  queue = queue.then(() => append(line)).catch((err) => console.error('[agents] log', err))
}
