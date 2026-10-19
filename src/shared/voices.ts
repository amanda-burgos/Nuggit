// SPEC 9.10: the system voices Dip can answer with, and which one is best. On a Mac the
// list comes from `say -v '?'`, which (unlike the browser's speechSynthesis) says which
// voices are the downloaded "Enhanced" or "Premium" ones. Shared so it can be tested.

export type VoiceQuality = 'premium' | 'enhanced' | 'standard' | 'basic'

export interface SystemVoice {
  id: string // the full system name, e.g. "Paulina (Enhanced)"; what `say -v` takes
  name: string // e.g. "Paulina"
  lang: string // BCP 47, e.g. "es-MX"
  quality: VoiceQuality
}

const RANK: Record<VoiceQuality, number> = { premium: 3, enhanced: 2, standard: 1, basic: 0 }

// Old synthetic voices (Eloquence and the classic Mac ones): understandable, but robotic.
const BASIC = new Set([
  'Eddy',
  'Flo',
  'Grandma',
  'Grandpa',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
  'Albert',
  'Fred',
  'Junior',
  'Kathy',
  'Ralph'
])

// Sound effects rather than voices: never offered for Dip.
const NOVELTY = new Set([
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Good News',
  'Jester',
  'Organ',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox'
])

// One line of `say -v '?'`: "Paulina (Enhanced)   es_MX    # ¡Hola! Me llamo Paulina."
const LINE = /^(.+?)\s+([a-z]{2,3}_[A-Za-z0-9]{2,4})\s+#/

export function parseSayVoices(output: string): SystemVoice[] {
  const voices: SystemVoice[] = []
  for (const line of output.split('\n')) {
    const match = LINE.exec(line.trim())
    if (!match) continue
    const id = match[1].trim()
    const lang = match[2].replace('_', '-')
    // "Eddy (Spanish (Spain))", "Mónica (Premium)" → "Eddy", "Mónica".
    const name = id.replace(/\s*\(.*\)\s*$/, '')
    if (NOVELTY.has(name)) continue
    const quality: VoiceQuality = /\(premium\)/i.test(id)
      ? 'premium'
      : /\(enhanced\)/i.test(id)
        ? 'enhanced'
        : BASIC.has(name)
          ? 'basic'
          : 'standard'
    voices.push({ id, name, lang, quality })
  }
  return voices
}

const langOf = (voice: SystemVoice): string => voice.lang.slice(0, 2).toLowerCase()

// The best voice for a language: Premium, then Enhanced, then a regular one, robotic last.
// Among equals, the system's own region first (es-MX in Mexico), then Latin American
// Spanish (es-MX, es-US) before Spain's.
export function bestVoice(
  voices: SystemVoice[],
  lang: 'es' | 'en',
  locale = 'es-MX'
): SystemVoice | undefined {
  const regions =
    lang === 'es' ? [locale, 'es-MX', 'es-US', 'es-419', 'es-ES'] : [locale, 'en-US', 'en-GB']
  const regionRank = (v: SystemVoice): number => {
    const i = regions.findIndex((r) => r.toLowerCase() === v.lang.toLowerCase())
    return i === -1 ? regions.length : i
  }
  return voices
    .filter((v) => langOf(v) === lang)
    .sort((a, b) => RANK[b.quality] - RANK[a.quality] || regionRank(a) - regionRank(b))[0]
}

// The chosen voice when it speaks the answer's language; otherwise the best that does.
export function voiceFor(
  voices: SystemVoice[],
  chosenId: string | undefined,
  lang: 'es' | 'en',
  locale?: string
): SystemVoice | undefined {
  const chosen = voices.find((v) => v.id === chosenId)
  if (chosen && langOf(chosen) === lang) return chosen
  return bestVoice(voices, lang, locale)
}

export function sortVoices(voices: SystemVoice[]): SystemVoice[] {
  return [...voices].sort(
    (a, b) =>
      RANK[b.quality] - RANK[a.quality] ||
      a.lang.localeCompare(b.lang) ||
      a.name.localeCompare(b.name)
  )
}

export const hasGoodVoice = (voices: SystemVoice[], lang: 'es' | 'en'): boolean =>
  voices.some((v) => langOf(v) === lang && RANK[v.quality] >= RANK.enhanced)
