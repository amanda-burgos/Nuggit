// Voice activity detection for the call mode (SPEC 9.10): tells when the person starts
// and stops talking, from the loudness (RMS) of each slice of microphone sound. It learns
// the room's background noise, so it works in a quiet room and in a noisy one.

export interface VadOptions {
  startMs: number // this much voice in a row = they started talking
  endMs: number // this much quiet in a row = they finished
  minSpeechMs: number // shorter than this (a cough, a click) is ignored
  maxSpeechMs: number // a turn never runs longer than this
}

export const DEFAULT_VAD: VadOptions = {
  startMs: 120,
  endMs: 900,
  minSpeechMs: 300,
  maxSpeechMs: 30_000
}

export type VadEvent = 'start' | 'end' | 'discard' | null

export class Vad {
  private noise = 0.004
  private speaking = false
  private loudMs = 0
  private quietMs = 0
  private speechMs = 0

  constructor(private readonly options: VadOptions = DEFAULT_VAD) {}

  get isSpeaking(): boolean {
    return this.speaking
  }

  // How loud counts as voice. "strict" while Dip talks, so its own voice coming back
  // through the speakers doesn't count as the person interrupting.
  threshold(strict: boolean): number {
    return strict ? Math.max(this.noise * 6, 0.05) : Math.max(this.noise * 3, 0.012)
  }

  feed(rms: number, frameMs: number, strict = false): VadEvent {
    const loud = rms > this.threshold(strict)
    if (!this.speaking) {
      // Learn the background: quickly when it gets quieter, slowly when louder.
      if (!loud)
        this.noise =
          rms < this.noise ? this.noise * 0.9 + rms * 0.1 : this.noise * 0.995 + rms * 0.005
      this.loudMs = loud ? this.loudMs + frameMs : 0
      const needed = strict ? Math.max(this.options.startMs, 250) : this.options.startMs
      if (this.loudMs >= needed) {
        this.speaking = true
        this.speechMs = this.loudMs
        this.quietMs = 0
        return 'start'
      }
      return null
    }
    this.speechMs += frameMs
    // A bit of hysteresis: a slightly softer sound still counts as talking.
    this.quietMs = rms > this.threshold(strict) * 0.7 ? 0 : this.quietMs + frameMs
    if (this.quietMs >= this.options.endMs || this.speechMs >= this.options.maxSpeechMs) {
      const spoken = this.speechMs - this.quietMs
      this.reset()
      return spoken >= this.options.minSpeechMs ? 'end' : 'discard'
    }
    return null
  }

  reset(): void {
    this.speaking = false
    this.loudMs = 0
    this.quietMs = 0
    this.speechMs = 0
  }
}

export function rmsOf(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}
