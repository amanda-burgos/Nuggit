import { describe, expect, it } from 'vitest'
import { yesOrNo } from './confirm'
import { Vad } from './vad'
import { downsample, encodeWav } from './wav'

const FRAME = 50 // ms

function run(vad: Vad, pattern: Array<[number, number]>, strict = false): string[] {
  const events: string[] = []
  for (const [rms, ms] of pattern) {
    for (let t = 0; t < ms; t += FRAME) {
      const event = vad.feed(rms, FRAME, strict)
      if (event) events.push(event)
    }
  }
  return events
}

describe('voice activity detection', () => {
  it('finds a turn: quiet, talking, then a pause', () => {
    const vad = new Vad()
    expect(
      run(vad, [
        [0.003, 1000],
        [0.08, 1500],
        [0.003, 1200]
      ])
    ).toEqual(['start', 'end'])
  })

  it('ignores a click and short noises', () => {
    const vad = new Vad()
    expect(
      run(vad, [
        [0.003, 1000],
        [0.2, 50],
        [0.003, 1000]
      ])
    ).toEqual([])
    expect(
      run(vad, [
        [0.2, 150],
        [0.003, 1200]
      ])
    ).toEqual(['start', 'discard'])
  })

  it('a short breath does not end the turn', () => {
    const vad = new Vad()
    expect(
      run(vad, [
        [0.003, 500],
        [0.08, 800],
        [0.003, 400],
        [0.08, 800],
        [0.003, 1000]
      ])
    ).toEqual(['start', 'end'])
  })

  it('while Dip talks, its echo does not count as interrupting, a real voice does', () => {
    const vad = new Vad()
    run(vad, [[0.003, 1000]])
    expect(run(vad, [[0.03, 1000]], true)).toEqual([])
    expect(run(vad, [[0.15, 400]], true)).toEqual(['start'])
  })

  it('adapts to a noisy room', () => {
    const vad = new Vad()
    expect(run(vad, [[0.02, 3000]])).toEqual(['start'])
    const noisy = new Vad()
    // A steady background hum is learned slowly while it stays below the voice level.
    run(noisy, [[0.008, 5000]])
    expect(noisy.threshold(false)).toBeGreaterThan(0.012)
  })
})

describe('wav', () => {
  it('downsamples 48 kHz to 16 kHz and writes a valid header', () => {
    const input = new Float32Array(48_000).fill(0.5)
    const out = downsample(input, 48_000)
    expect(out.length).toBe(16_000)
    const wav = encodeWav(out)
    const text = (o: number): string => String.fromCharCode(...wav.slice(o, o + 4))
    expect([text(0), text(8), text(36)]).toEqual(['RIFF', 'WAVE', 'data'])
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(16_000)
    expect(wav.length).toBe(44 + 32_000)
  })
})

describe('yes or no', () => {
  it('understands short answers', () => {
    expect(yesOrNo('Sí.')).toBe('yes')
    expect(yesOrNo('sí, por favor')).toBe('yes')
    expect(yesOrNo('Dale')).toBe('yes')
    expect(yesOrNo('No, gracias')).toBe('no')
    expect(yesOrNo('mejor no')).toBe('no')
  })

  it('leaves longer answers to Dip', () => {
    expect(yesOrNo('no, mejor ponla para el viernes en la tarde')).toBeNull()
    expect(yesOrNo('¿qué tareas tengo hoy?')).toBeNull()
  })
})
