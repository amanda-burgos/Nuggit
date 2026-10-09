import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

// Pending writes per file, so two saves never race on the same temp file.
const writeQueues = new Map<string, Promise<void>>()

function filePath(name: string): string {
  return join(app.getPath('userData'), `${name}.json`)
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const path = filePath(name)
  let raw: string
  try {
    raw = await fs.readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    // Keep the broken file aside instead of overwriting it later.
    const backup = filePath(`${name}.corrupt-${Date.now()}`)
    await fs.rename(path, backup).catch(() => undefined)
    console.error(`[storage] ${name}.json was corrupt, moved to ${backup}`)
    return fallback
  }
}

// Write to a temp file and rename it, so a crash never leaves half a file.
export function writeJson(name: string, data: unknown): Promise<void> {
  const path = filePath(name)
  const previous = writeQueues.get(name) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const tmp = `${path}.tmp`
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
      await fs.rename(tmp, path)
    })
  writeQueues.set(name, next)
  return next
}

// Resolves once every queued write has finished.
export async function flushWrites(): Promise<void> {
  await Promise.allSettled(writeQueues.values())
}
