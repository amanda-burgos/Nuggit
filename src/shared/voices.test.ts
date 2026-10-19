import { describe, expect, it } from 'vitest'
import { bestVoice, hasGoodVoice, parseSayVoices, voiceFor } from './voices'

// What `say -v '?'` prints on a Mac with some voices downloaded.
const SAY = `Eddy (Spanish (Spain)) es_ES    # ¡Hola! Me llamo Eddy.
Eddy (Spanish (Mexico)) es_MX    # ¡Hola! Me llamo Eddy.
Mónica              es_ES    # ¡Hola! Me llamo Mónica.
Mónica (Premium)    es_ES    # ¡Hola! Me llamo Mónica.
Paulina             es_MX    # ¡Hola! Me llamo Paulina.
Paulina (Enhanced)  es_MX    # ¡Hola! Me llamo Paulina.
Samantha            en_US    # Hello! My name is Samantha.
Zoe (Premium)       en_US    # Hello! My name is Zoe.
Bubbles             en_US    # Hello! My name is Bubbles.`

describe('system voices', () => {
  const voices = parseSayVoices(SAY)

  it('reads names, languages and quality, and leaves out the sound effects', () => {
    expect(voices.find((v) => v.id === 'Paulina (Enhanced)')).toEqual({
      id: 'Paulina (Enhanced)',
      name: 'Paulina',
      lang: 'es-MX',
      quality: 'enhanced'
    })
    expect(voices.find((v) => v.id === 'Eddy (Spanish (Spain))')?.quality).toBe('basic')
    expect(voices.find((v) => v.id === 'Mónica')?.quality).toBe('standard')
    expect(voices.some((v) => v.name === 'Bubbles')).toBe(false)
  })

  it('picks the best Spanish voice: Premium, then Enhanced, never a robotic one first', () => {
    expect(bestVoice(voices, 'es', 'en-US')?.id).toBe('Mónica (Premium)')
    const noPremium = voices.filter((v) => v.quality !== 'premium')
    expect(bestVoice(noPremium, 'es', 'en-US')?.id).toBe('Paulina (Enhanced)')
    const basicOnly = parseSayVoices(SAY.split('\n').slice(0, 3).join('\n'))
    expect(bestVoice(basicOnly, 'es', 'en-US')?.id).toBe('Mónica')
    expect(hasGoodVoice(basicOnly, 'es')).toBe(false)
  })

  it('among equals, prefers the system region, then Latin America', () => {
    const plain = voices.filter((v) => v.quality === 'standard')
    expect(bestVoice(plain, 'es', 'es-ES')?.id).toBe('Mónica')
    expect(bestVoice(plain, 'es', 'en-US')?.id).toBe('Paulina')
  })

  it('keeps the chosen voice unless the answer is in another language', () => {
    expect(voiceFor(voices, 'Paulina', 'es')?.id).toBe('Paulina')
    expect(voiceFor(voices, 'Paulina', 'en')?.id).toBe('Zoe (Premium)')
  })
})
