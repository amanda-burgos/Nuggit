import { app, BrowserWindow } from 'electron'
import { GoogleGenAI } from '@google/genai'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { createWriteStream, existsSync, promises as fs } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as WebReadableStream } from 'stream/web'
import type {
  ModelDownload,
  Settings,
  SttBackend,
  SttStatus,
  TranscribeResult
} from '../shared/types'
import { customConfig, geminiKey } from './ai'
import { resolveSttConfig, type SttConfig } from './ai/config'
import { AIError } from './ai/provider'
import { loadSettings } from './storage'

// SPEC 9.10, call mode: speech to text. Configurable like the AI providers (8.1):
// - whisper: whisper.cpp on this Mac (brew install whisper-cpp + a model Nuggit downloads).
//   Free and private: the audio never leaves the computer.
// - custom: the user's own server, if it has /audio/transcriptions (OpenAI API).
// - gemini: Gemini listens to the clip and writes what it says.
// "auto" tries them in config/ai.defaults.json's order, skipping what isn't set up.
// The audio is a short WAV of one thing the user said; nothing is kept.

const MODELS = {
  base: { file: 'ggml-base.bin', sizeMB: 148 },
  small: { file: 'ggml-small.bin', sizeMB: 488 }
}
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/'
const WHISPER_PLACES = ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli']
const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // ~5 minutes at 16 kHz: far more than one turn
const TIMEOUT_MS = 60_000
// Words whisper should expect (it writes "A nota" for "Anota" otherwise).
const PROMPT = 'Dip, Nuggit, anota, tarea, tareas, tenders, dailies.'

// What whisper "hears" in silence or noise, learned from subtitles: never a real request.
const HALLUCINATIONS = [
  /subt[ií]tulos (realizados|por)/i,
  /amara\.org/i,
  /gracias por ver/i,
  /suscr[ií]bete/i,
  /thanks? for watching/i,
  /^\s*[[(].*[\])]\s*$/ // [Música], (risas)...
]

const modelsDir = (): string => join(app.getPath('userData'), 'models')

function whisperBin(config: SttConfig): string | null {
  if (config.whisperBin) return existsSync(config.whisperBin) ? config.whisperBin : null
  return WHISPER_PLACES.find((p) => existsSync(p)) ?? null
}

function whisperModelPath(config: SttConfig): string {
  return config.whisperModelPath ?? join(modelsDir(), MODELS[config.whisperModel.value].file)
}

async function setUp(config: SttConfig, settings: Settings): Promise<Record<SttBackend, boolean>> {
  return {
    whisper: Boolean(whisperBin(config)) && existsSync(whisperModelPath(config)),
    custom: Boolean(await customConfig(settings)),
    gemini: Boolean(await geminiKey())
  }
}

export async function getSttStatus(): Promise<SttStatus> {
  const settings = await loadSettings()
  const config = resolveSttConfig(settings)
  const ready = await setUp(config, settings)
  const choice = config.provider.value
  return {
    active:
      choice === 'auto'
        ? (config.order.find((b) => ready[b]) ?? null)
        : ready[choice]
          ? choice
          : null,
    provider: choice,
    fromEnv: config.provider.source === 'env',
    whisper: {
      bin: whisperBin(config),
      model: config.whisperModel.value,
      modelReady: existsSync(whisperModelPath(config)),
      modelSizeMB: MODELS[config.whisperModel.value].sizeMB
    },
    custom: ready.custom,
    gemini: ready.gemini
  }
}

// --- The three ways ---

function cleanText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return HALLUCINATIONS.some((re) => re.test(clean)) ? '' : clean
}

async function withWhisper(wav: Uint8Array, lang: string, config: SttConfig): Promise<string> {
  const bin = whisperBin(config)
  if (!bin)
    throw new AIError('Falta whisper.cpp. Instálalo en la Terminal con: brew install whisper-cpp')
  const model = whisperModelPath(config)
  if (!existsSync(model)) throw new AIError('Falta bajar el modelo de whisper (Ajustes → Voz).')
  const file = join(app.getPath('temp'), `nuggit-heard-${randomUUID()}.wav`)
  await fs.writeFile(file, wav)
  try {
    const stdout = await new Promise<string>((resolve, reject) =>
      execFile(
        bin,
        ['-m', model, '-f', file, '-l', lang, '-nt', '-np', '-sns', '--prompt', PROMPT],
        { timeout: TIMEOUT_MS },
        (err, out) => (err ? reject(err) : resolve(out))
      )
    )
    return stdout
  } finally {
    await fs.rm(file, { force: true })
  }
}

async function withServer(wav: Uint8Array, lang: string, config: SttConfig): Promise<string> {
  const server = await customConfig()
  if (!server) throw new AIError('No hay un servidor propio en Ajustes.')
  let lastError: unknown = null
  for (const base of server.servers) {
    try {
      const form = new FormData()
      form.append('file', new Blob([Buffer.from(wav)], { type: 'audio/wav' }), 'audio.wav')
      form.append('model', config.openaiModel)
      if (lang !== 'auto') form.append('language', lang)
      const response = await fetch(`${base}/audio/transcriptions`, {
        method: 'POST',
        headers: server.key ? { Authorization: `Bearer ${server.key}` } : undefined,
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      if (response.status === 404) {
        throw new AIError('Tu servidor no transcribe audio (no tiene /audio/transcriptions).')
      }
      if (!response.ok) throw new AIError(`Tu servidor no pudo transcribir (${response.status}).`)
      const data = (await response.json()) as { text?: unknown }
      return typeof data.text === 'string' ? data.text : ''
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof AIError ? lastError : new AIError('No llego a tu servidor.')
}

async function withGemini(wav: Uint8Array, lang: string, config: SttConfig): Promise<string> {
  const apiKey = await geminiKey()
  if (!apiKey) throw new AIError('No hay una key de Gemini guardada.')
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } })
  const language = lang === 'es' ? 'en español ' : lang === 'en' ? 'in English ' : ''
  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: Buffer.from(wav).toString('base64') } },
          {
            text: `Escribe exactamente lo que dice la persona ${language}en este audio. Solo la transcripción, sin comillas ni comentarios. Si no se entiende nada, responde vacío.`
          }
        ]
      }
    ]
  })
  return response.text ?? ''
}

const WAYS: Record<SttBackend, typeof withWhisper> = {
  whisper: withWhisper,
  custom: withServer,
  gemini: withGemini
}

// One thing the user said → text. In auto mode, if one way fails the next is tried.
export async function transcribe(input: unknown, langInput: unknown): Promise<TranscribeResult> {
  if (
    !(input instanceof Uint8Array) ||
    input.byteLength < 44 ||
    input.byteLength > MAX_AUDIO_BYTES
  ) {
    return { ok: false, error: 'No llegó el audio.' }
  }
  const settings = await loadSettings()
  const config = resolveSttConfig(settings)
  const lang =
    langInput === 'es' || langInput === 'en' ? langInput : (settings.voice.callLang ?? 'auto')
  const ready = await setUp(config, settings)
  const choice = config.provider.value
  const backends = choice === 'auto' ? config.order.filter((b) => ready[b]) : [choice]
  if (!backends.length) {
    return {
      ok: false,
      error:
        'Para hablar con Dip falta algo que entienda tu voz. Revisa Ajustes → Voz → Modo llamada.'
    }
  }
  let firstError: unknown = null
  for (const backend of backends) {
    try {
      const text = cleanText(await WAYS[backend](input, lang, config))
      return { ok: true, text, backend }
    } catch (err) {
      console.warn(`[stt] ${backend} failed`, err instanceof Error ? err.message : err)
      firstError ??= err
    }
  }
  return {
    ok: false,
    error: firstError instanceof AIError ? firstError.message : 'No pude entender el audio.'
  }
}

// whisper's first run after the Mac starts takes several seconds (Metal prepares the GPU).
// The call screen asks for this as it opens, so the first real answer is quick.
let warmedUp = false

export async function warmUpStt(): Promise<void> {
  if (warmedUp) return
  const config = resolveSttConfig(await loadSettings())
  const ready = whisperBin(config) && existsSync(whisperModelPath(config))
  if (!ready || (config.provider.value !== 'auto' && config.provider.value !== 'whisper')) return
  warmedUp = true
  // Half a second of silence: a valid 16 kHz WAV with nothing to hear.
  const samples = 8000
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + samples * 2, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  await withWhisper(new Uint8Array(wav), 'es', config).catch(() => {
    warmedUp = false
  })
}

// --- Downloading a whisper model (once, into the data folder) ---

let downloading: Promise<void> | null = null

function report(progress: ModelDownload): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('stt:download', progress)
}

export function downloadModel(): Promise<void> {
  downloading ??= (async () => {
    const config = resolveSttConfig(await loadSettings())
    const { file, sizeMB } = MODELS[config.whisperModel.value]
    const target = join(modelsDir(), file)
    const partial = `${target}.part`
    try {
      await fs.mkdir(modelsDir(), { recursive: true })
      const response = await fetch(`${MODEL_URL}${file}`)
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      const total = Number(response.headers.get('content-length')) || sizeMB * 1024 * 1024
      let received = 0
      let lastReport = 0
      const body = Readable.fromWeb(response.body as WebReadableStream)
      body.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (Date.now() - lastReport > 250) {
          lastReport = Date.now()
          report({ state: 'downloading', progress: Math.min(1, received / total) })
        }
      })
      await pipeline(body, createWriteStream(partial))
      await fs.rename(partial, target)
      report({ state: 'done' })
    } catch (err) {
      console.error('[stt] model download failed', err)
      await fs.rm(partial, { force: true })
      report({ state: 'error', error: 'No pude bajar el modelo. ¿Hay internet? Intenta otra vez.' })
    } finally {
      downloading = null
    }
  })()
  return downloading
}
