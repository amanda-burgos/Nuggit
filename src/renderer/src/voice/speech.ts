import { useEffect, useState } from 'react'
import type { VoiceSettings } from '../../../shared/types'

// SPEC 9.10: Dip answers out loud with the system voice (speechSynthesis). Everything here
// stays on this computer.

// Emojis, markdown marks and links sound bad read aloud: they go.
export function speakableText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(
      /\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D}/gu,
      ''
    )
    .replace(/[*_#`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const ENGLISH = /\b(the|and|you|is|are|to|it|what|how|your|for|with|this|that|i'm|don't)\b/gi
const SPANISH = /\b(el|la|los|las|que|de|y|es|en|un|una|para|con|tu|por|lo|se|qué|cómo)\b/gi

// Dip answers in the language it was spoken to: guess which one to read it in.
export function guessLang(text: string): 'es' | 'en' {
  const en = text.match(ENGLISH)?.length ?? 0
  const es = text.match(SPANISH)?.length ?? 0
  return en > es ? 'en' : 'es'
}

// The chosen voice if it fits the language. Otherwise one that does, preferring the
// system's own region (es-MX for someone in Mexico), then voices that work offline.
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  voiceURI: string | undefined,
  lang: 'es' | 'en',
  locale = navigator.language
): SpeechSynthesisVoice | undefined {
  const fits = (v: SpeechSynthesisVoice): boolean => v.lang.toLowerCase().startsWith(lang)
  const chosen = voices.find((v) => v.voiceURI === voiceURI)
  if (chosen && fits(chosen)) return chosen
  const matching = voices.filter(fits)
  const sameRegion = (v: SpeechSynthesisVoice): boolean =>
    v.lang.toLowerCase().replace('_', '-') === locale.toLowerCase()
  return (
    matching.find((v) => sameRegion(v) && v.localService) ??
    matching.find((v) => v.default) ??
    matching.find((v) => v.localService) ??
    matching[0]
  )
}

export function speak(text: string, settings: VoiceSettings): void {
  if (!('speechSynthesis' in window)) return
  const clean = speakableText(text)
  if (!clean) return
  const lang = guessLang(clean)
  const utterance = new SpeechSynthesisUtterance(clean)
  const voice = pickVoice(window.speechSynthesis.getVoices(), settings.voiceURI, lang)
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? (lang === 'es' ? 'es-MX' : 'en-US')
  utterance.rate = settings.rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// The system voices in Spanish and English (the list fills in a moment after start-up).
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = (): void =>
      setVoices(
        window.speechSynthesis
          .getVoices()
          .filter((v) => /^(es|en)/i.test(v.lang))
          .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
      )
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}
