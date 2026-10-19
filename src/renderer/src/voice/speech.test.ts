import { describe, expect, it } from 'vitest'
import { guessLang, pickVoice, speakableText } from './speech'

const voice = (name: string, lang: string, localService = true): SpeechSynthesisVoice =>
  ({ name, lang, voiceURI: name, localService, default: false }) as SpeechSynthesisVoice

describe('speech', () => {
  it('drops emojis, markdown and links before reading', () => {
    expect(speakableText('¡Listo! 🎉 **Anotada** para el jueves 👍🏽 https://x.com')).toBe(
      '¡Listo! Anotada para el jueves'
    )
  })

  it('guesses the language of the answer', () => {
    expect(guessLang('¿Qué tal si empiezas por la tarea de mate?')).toBe('es')
    expect(guessLang('What if you start with the math homework?')).toBe('en')
  })

  it('uses the chosen voice only when it fits the language', () => {
    const voices = [voice('Paulina', 'es-MX'), voice('Samantha', 'en-US'), voice('Jorge', 'es-ES')]
    expect(pickVoice(voices, 'Jorge', 'es', 'es-MX')?.name).toBe('Jorge')
    expect(pickVoice(voices, 'Jorge', 'en', 'es-MX')?.name).toBe('Samantha')
    expect(pickVoice(voices, undefined, 'es', 'es-ES')?.name).toBe('Jorge')
    expect(pickVoice(voices, undefined, 'es', 'es-MX')?.name).toBe('Paulina')
  })
})
