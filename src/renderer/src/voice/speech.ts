import { useCallback, useEffect, useState } from 'react'
import type { VoiceSettings } from '../../../shared/types'
import { voiceFor, type SystemVoice } from '../../../shared/voices'

// SPEC 9.10: Dip answers out loud with a system voice. On a Mac it is the voice chosen in
// Ajustes (or the best one installed) through `say`, played here so the pitch can be set
// apart from the speed. Elsewhere, the browser's speechSynthesis. Nothing leaves the
// computer.

const IS_MAC = navigator.userAgent.includes('Mac')
// `say`'s normal speed, in words per minute.
const BASE_WPM = 175

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

// --- The Mac's voices, loaded once (again with "Actualizar") ---

let voicesPromise: Promise<SystemVoice[]> | null = null

export function loadSystemVoices(fresh = false): Promise<SystemVoice[]> {
  if (!IS_MAC) return Promise.resolve([])
  if (!voicesPromise || fresh) {
    voicesPromise = window.api.voice.voices(fresh).catch((err) => {
      console.error('Could not load the voices', err)
      return []
    })
  }
  return voicesPromise
}

export function useSystemVoices(): {
  voices: SystemVoice[] | null
  refresh(): Promise<void>
} {
  const [voices, setVoices] = useState<SystemVoice[] | null>(null)
  useEffect(() => {
    let cancelled = false
    loadSystemVoices().then((list) => {
      if (!cancelled) setVoices(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const refresh = useCallback(async () => setVoices(await loadSystemVoices(true)), [])
  return { voices, refresh }
}

// --- Speaking ---

let playing: HTMLAudioElement | null = null
let turn = 0 // a newer speak() or stopSpeaking() makes older ones drop their audio

export function stopSpeaking(): void {
  turn++
  playing?.pause()
  playing = null
  if (IS_MAC) window.api.voice.stop().catch(() => undefined)
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function speak(text: string, settings: VoiceSettings): Promise<void> {
  stopSpeaking()
  const mine = turn
  const clean = speakableText(text)
  if (!clean) return
  const lang = guessLang(clean)
  const voices = await loadSystemVoices()
  if (voices.length) {
    const voice = voiceFor(voices, settings.voiceURI, lang, navigator.language)
    // Playing faster raises the pitch and the speed together: `say` talks slower to
    // make up for it, so only the pitch changes.
    const data = await window.api.voice.synthesize({
      text: clean,
      voice: voice?.id,
      wpm: (BASE_WPM * settings.rate) / settings.pitch
    })
    if (!data || mine !== turn) return
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'audio/wav' }))
    const audio = new Audio(url)
    audio.preservesPitch = false
    audio.playbackRate = settings.pitch
    audio.onended = () => URL.revokeObjectURL(url)
    playing = audio
    await audio.play().catch((err) => console.error('Could not play the voice', err))
    return
  }
  speakWithBrowser(clean, lang, settings)
}

// Not a Mac (or `say` failed): the browser's voices.
function speakWithBrowser(text: string, lang: 'es' | 'en', settings: VoiceSettings): void {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  const fits = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith(lang))
  const voice =
    fits.find((v) => v.voiceURI === settings.voiceURI) ?? fits.find((v) => v.localService)
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? (lang === 'es' ? 'es-MX' : 'en-US')
  utterance.rate = settings.rate
  utterance.pitch = settings.pitch
  window.speechSynthesis.speak(utterance)
}
