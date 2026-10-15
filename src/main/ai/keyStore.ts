import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

// The Gemini key is stored encrypted with the OS keychain (safeStorage), in its own file
// in the app's data folder. It never goes to settings.json, the repo or the interface.
const FILE = 'gemini-key.bin'
let cached: string | null | undefined

function keyPath(): string {
  return join(app.getPath('userData'), FILE)
}

export function canEncrypt(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function loadKey(): Promise<string | null> {
  if (cached !== undefined) return cached
  try {
    cached = safeStorage.decryptString(await fs.readFile(keyPath()))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[ai] could not read the saved key', err)
    }
    cached = null
  }
  return cached
}

export async function saveKey(key: string): Promise<void> {
  const path = keyPath()
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(`${path}.tmp`, safeStorage.encryptString(key), { mode: 0o600 })
  await fs.rename(`${path}.tmp`, path)
  cached = key
}

export async function removeKey(): Promise<void> {
  await fs.rm(keyPath(), { force: true })
  cached = null
}
