import type { VoiceSettings } from '../../../../shared/types'
import { guessLang, speak, stopSpeaking } from '../speech'
import { yesOrNo } from './confirm'
import { rmsOf, Vad } from './vad'
import { downsample, encodeWav } from './wav'
import { t } from '../../../../shared/i18n'

// SPEC 9.10, call mode: a hands-free conversation with Dip. The loop: listen → notice when
// the person stops talking → turn it into text → Dip answers (short, spoken) → say it out
// loud → listen again. Talking while Dip talks interrupts it. "Sí"/"no" answer a proposal.
// Everything said ends up in Dip's usual chat history, as text.

export type CallPhase =
  | 'checking'
  | 'explain-mic' // before macOS asks for the microphone, say why
  | 'mic-denied'
  | 'no-stt' // nothing set up to understand speech
  | 'connecting'
  | 'listening'
  | 'hearing' // the person is talking
  | 'thinking' // transcribing and waiting for Dip
  | 'speaking'

export interface CallState {
  phase: CallPhase
  muted: boolean
  level: number // 0–1, the microphone's loudness, for the animation
  heard: string // the last thing the person said
  said: string // the last thing Dip said
  error: string | null
}

export const INITIAL_CALL: CallState = {
  phase: 'checking',
  muted: false,
  level: 0,
  heard: '',
  said: '',
  error: null
}

// Kept from before the voice was noticed, so the first word isn't cut (it starts softer,
// and while Dip talks it takes a louder voice to notice).
const PRE_ROLL_MS = 500
const LEVEL_EVERY_MS = 80

export class CallEngine {
  private state: CallState = INITIAL_CALL
  private closed = false
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private vad = new Vad()
  private preRoll: Float32Array[] = []
  private recording: Float32Array[] = []
  private lastLevel = 0

  constructor(
    private readonly emit: (state: CallState) => void,
    private readonly voice: () => VoiceSettings
  ) {}

  private set(patch: Partial<CallState>): void {
    this.state = { ...this.state, ...patch }
    if (!this.closed) this.emit(this.state)
  }

  async start(): Promise<void> {
    const stt = await window.api.voice.sttStatus().catch(() => null)
    if (this.closed) return
    if (!stt?.active) return this.set({ phase: 'no-stt' })
    // whisper's first run of the session is slow (it prepares the GPU): do it now.
    window.api.voice.warmUpStt().catch(() => undefined)
    const access = await window.api.voice.micAccess()
    if (access === 'not-determined') return this.set({ phase: 'explain-mic' })
    if (access === 'denied') return this.set({ phase: 'mic-denied' })
    await this.open()
  }

  // After the explanation: macOS's own question, only this first time.
  async allowMic(): Promise<void> {
    const ok = await window.api.voice.askMic()
    if (this.closed) return
    if (ok) await this.open()
    else this.set({ phase: 'mic-denied' })
  }

  private async open(): Promise<void> {
    this.set({ phase: 'connecting', error: null })
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      })
    } catch (err) {
      console.error('[call] no microphone', err)
      return this.set({ phase: 'mic-denied' })
    }
    if (this.closed) return this.stopStream()
    const context = new AudioContext()
    const source = context.createMediaStreamSource(this.stream)
    // The processor only runs while connected to the output: through a silent gain.
    const processor = context.createScriptProcessor(2048, 1, 1)
    const silent = context.createGain()
    silent.gain.value = 0
    source.connect(processor)
    processor.connect(silent)
    silent.connect(context.destination)
    processor.onaudioprocess = (e) => this.onFrame(e.inputBuffer.getChannelData(0))
    this.context = context
    this.processor = processor
    await this.say(t('¡Hola! Te escucho.', "Hi! I'm listening."))
  }

  private onFrame(data: Float32Array): void {
    if (this.closed || !this.context) return
    const frame = new Float32Array(data)
    const frameMs = (frame.length / this.context.sampleRate) * 1000
    const rms = rmsOf(frame)
    const now = performance.now()
    if (now - this.lastLevel > LEVEL_EVERY_MS) {
      this.lastLevel = now
      this.set({ level: this.state.muted ? 0 : Math.min(1, rms * 10) })
    }
    if (this.state.muted) return

    const { phase } = this.state
    // While transcribing or waiting for Dip, what is said isn't a new turn yet.
    if (phase !== 'listening' && phase !== 'hearing' && phase !== 'speaking') {
      return this.keep(frame, frameMs)
    }
    const event = this.vad.feed(rms, frameMs, phase === 'speaking')
    if (event === 'start') {
      this.recording = [...this.preRoll]
      this.preRoll = []
      if (phase === 'speaking') stopSpeaking() // interrupted: Dip stops and listens
      this.set({ phase: 'hearing' })
    }
    if (this.vad.isSpeaking || event === 'end' || event === 'discard') this.recording.push(frame)
    else this.keep(frame, frameMs)

    if (event === 'end') {
      const turn = this.recording
      this.recording = []
      void this.handleTurn(turn)
    } else if (event === 'discard') {
      this.recording = []
      this.set({ phase: 'listening' })
    }
  }

  // The last moments before a turn starts.
  private keep(frame: Float32Array, frameMs: number): void {
    this.preRoll.push(frame)
    while (this.preRoll.length * frameMs > PRE_ROLL_MS) this.preRoll.shift()
  }

  private async handleTurn(frames: Float32Array[]): Promise<void> {
    if (!this.context) return
    this.set({ phase: 'thinking', error: null })
    const samples = new Float32Array(frames.reduce((n, f) => n + f.length, 0))
    let offset = 0
    for (const f of frames) {
      samples.set(f, offset)
      offset += f.length
    }
    const wav = encodeWav(downsample(samples, this.context.sampleRate))
    const heard = await window.api.voice.transcribe(wav, this.language()).catch(() => null)
    if (this.closed) return
    if (!heard?.ok) {
      this.set({ error: heard?.error ?? t('No pude entenderte.', "I couldn't understand you.") })
      return this.say(t('Perdón, no te entendí.', "Sorry, I didn't catch that."))
    }
    if (!heard.text) return this.set({ phase: 'listening' })
    this.set({ heard: heard.text })

    // "¿La guardo?" → "sí" / "no".
    const chat = await window.api.dipChat.load()
    const last = chat.messages[chat.messages.length - 1]
    const answer = yesOrNo(heard.text)
    if (last?.action && last.actionState === 'pending' && answer) {
      if (answer === 'yes') {
        const done = await window.api.dipChat.applyAction(last.id)
        return this.say(
          done.ok
            ? t('Listo, ya está.', 'Done, all set.')
            : (done.error ?? t('No pude hacerlo.', "I couldn't do it."))
        )
      }
      await window.api.dipChat.cancelAction(last.id)
      return this.say(t('Va, no lo hago.', "Okay, I won't."))
    }

    const reply = await window.api.dipChat.send(heard.text, { voice: true })
    if (this.closed) return
    await this.say(reply.ok ? reply.text : reply.error)
  }

  // A short "sí" can sound like English: unless a language was chosen, expect the one the
  // conversation is in.
  private language(): 'es' | 'en' | 'auto' {
    const chosen = this.voice().callLang
    if (chosen && chosen !== 'auto') return chosen
    const context = `${this.state.said} ${this.state.heard}`.trim()
    return context ? guessLang(context) : 'auto'
  }

  private async say(text: string): Promise<void> {
    if (this.closed) return
    this.vad.reset()
    this.set({ phase: 'speaking', said: text })
    await speak(text, this.voice())
    // If it was interrupted, the phase is already "hearing".
    if (!this.closed && this.state.phase === 'speaking') this.set({ phase: 'listening' })
  }

  toggleMute(): void {
    const muted = !this.state.muted
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
    this.vad.reset()
    this.recording = []
    this.set({ muted, level: 0 })
  }

  close(): void {
    this.closed = true
    stopSpeaking()
    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
    }
    this.stopStream()
    this.context?.close().catch(() => undefined)
    this.context = null
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }
}
