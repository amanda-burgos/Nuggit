import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

// API keys are stored encrypted with the OS keychain (safeStorage), each in its own file in
// the app's data folder. They never go to settings.json, the repo or the interface.

export interface KeyStore {
  load(): Promise<string | null>
  save(key: string): Promise<void>
  remove(): Promise<void>
}

export function canEncrypt(): boolean {
  return safeStorage.isEncryptionAvailable()
}

function createKeyStore(file: string): KeyStore {
  let cached: string | null | undefined
  const keyPath = (): string => join(app.getPath('userData'), file)

  return {
    async load() {
      if (cached !== undefined) return cached
      try {
        cached = safeStorage.decryptString(await fs.readFile(keyPath()))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`[ai] could not read the saved key (${file})`, err)
        }
        cached = null
      }
      return cached
    },

    async save(key) {
      const path = keyPath()
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      await fs.writeFile(`${path}.tmp`, safeStorage.encryptString(key), { mode: 0o600 })
      await fs.rename(`${path}.tmp`, path)
      cached = key
    },

    async remove() {
      await fs.rm(keyPath(), { force: true })
      cached = null
    }
  }
}

export const geminiKey = createKeyStore('gemini-key.bin')
export const serverKey = createKeyStore('server-key.bin') // the user's own server (optional)
