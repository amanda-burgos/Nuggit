import { describe, expect, it } from 'vitest'
import { guessLang, speakableText } from './speech'

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
})
