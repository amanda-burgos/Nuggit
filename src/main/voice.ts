import { app, BrowserWindow, Menu, shell, type WebContents } from 'electron'
import { execFile, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'
import { parseSayVoices, type SystemVoice } from '../shared/voices'

// SPEC 9.10, basic voice. Talking to Dip uses the Mac's own dictation: Nuggit only starts
// it in the text field that has the cursor, and macOS turns speech into text (nothing is
// recorded or sent anywhere by Nuggit).
//
// Dip's answers are spoken with the Mac's `say`: unlike the browser's speechSynthesis, it
// lists which voices are the downloaded "Enhanced"/"Premium" ones and really uses them. It
// makes a short audio file here, and the window that asked plays it (that is also where
// the pitch is set). Everything stays on this computer.

const IS_MAC = process.platform === 'darwin'
const MAX_TEXT = 2000
const SAY_TIMEOUT_MS = 30_000
// Where Dictation is turned on, and where better voices are downloaded (macOS 13+).
const DICTATION_SETTINGS = 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'
const VOICE_SETTINGS = 'x-apple.systempreferences:com.apple.Accessibility-Settings.extension'

export function dictate(from: WebContents): void {
  if (!IS_MAC) return
  const win = BrowserWindow.fromWebContents(from)
  if (win && !win.isFocused()) win.focus()
  // The same as Edit → Start Dictation. If Dictation is off, macOS offers to turn it on.
  Menu.sendActionToFirstResponder('startDictation:')
}

export async function openDictationSettings(): Promise<void> {
  if (IS_MAC) await shell.openExternal(DICTATION_SETTINGS)
}

export async function openVoiceSettings(): Promise<void> {
  if (IS_MAC) await shell.openExternal(VOICE_SETTINGS)
}

// speaking: the run that "stop" (or a newer answer) may cut short.
function run(args: string[], speaking = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('/usr/bin/say', args, { timeout: SAY_TIMEOUT_MS }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
    if (speaking) current = child
  })
}

let voices: SystemVoice[] | null = null
let current: ChildProcess | null = null

// The installed voices (cached; "fresh" reads them again, e.g. after downloading one).
export async function listVoices(fresh = false): Promise<SystemVoice[]> {
  if (!IS_MAC) return []
  if (voices && !fresh) return voices
  try {
    voices = parseSayVoices(await run(['-v', '?']))
  } catch (err) {
    console.error('[voice] could not list the voices', err)
    voices = []
  }
  return voices
}

// The answer as a WAV file, in that voice, at that speed (words per minute). A new request
// stops the one before, so only the latest answer is spoken.
export async function synthesize(input: unknown): Promise<Uint8Array | null> {
  if (!IS_MAC || typeof input !== 'object' || input === null) return null
  const { text, voice, wpm } = input as Record<string, unknown>
  if (typeof text !== 'string' || !text.trim()) return null
  const known = await listVoices()
  const voiceId = typeof voice === 'string' && known.some((v) => v.id === voice) ? voice : null
  const rate = typeof wpm === 'number' && Number.isFinite(wpm) ? Math.round(wpm) : 175
  current?.kill()
  const base = join(app.getPath('temp'), `nuggit-voice-${randomUUID()}`)
  try {
    await fs.writeFile(`${base}.txt`, text.slice(0, MAX_TEXT), 'utf8')
    await run(
      [
        ...(voiceId ? ['-v', voiceId] : []),
        '-r',
        String(Math.min(400, Math.max(80, rate))),
        '-f',
        `${base}.txt`,
        '-o',
        `${base}.wav`,
        '--file-format=WAVE',
        '--data-format=LEI16@22050'
      ],
      true
    )
    return new Uint8Array(await fs.readFile(`${base}.wav`))
  } catch (err) {
    // Killed because a newer answer came: not an error.
    if ((err as { killed?: boolean }).killed) return null
    console.error('[voice] could not speak', err)
    return null
  } finally {
    await fs.rm(`${base}.txt`, { force: true })
    await fs.rm(`${base}.wav`, { force: true })
  }
}

export function stopVoice(): void {
  current?.kill()
}
