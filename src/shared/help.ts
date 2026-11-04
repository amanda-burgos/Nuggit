import community from '../../config/community.json'
import rawHelp from '../../config/help.json'
import rawHelpEn from '../../config/help.en.json'
import { getLang, t } from './i18n'
import { withKeys } from './keys'

// Fase 10: the help texts live in config/help.json (easy to edit). The Ayuda tab shows
// them, and Dip reads the few that match a question about how to use Nuggit.

export interface HelpGuide {
  id: string
  icon: string
  title: string
  keywords: string[]
  text: string // **bold** allowed
}

export interface HelpCustomize {
  id: string
  icon: string
  title: string
  text: string
  settingsTab?: string // the Ajustes tab it opens (a SettingsTab)
}

export interface HelpQuestion {
  id: string
  q: string
  a: string
  keywords: string[]
}

export interface HelpShortcut {
  keys: string
  what: string
}

export interface HelpContent {
  guides: HelpGuide[]
  customize: HelpCustomize[]
  faq: HelpQuestion[]
  shortcuts: HelpShortcut[]
}

const HELP_ES: HelpContent = rawHelp
const HELP_EN: HelpContent = rawHelpEn

// The help texts in the current language.
// With the shortcut markers ({mod}…) written the way this system shows them (keys.ts).
// A shortcut with no keys on this system (dictation on Linux) is left out.
function forThisSystem(help: HelpContent): HelpContent {
  const fill = (value: unknown): unknown =>
    typeof value === 'string'
      ? withKeys(value)
      : Array.isArray(value)
        ? value.map(fill)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]))
          : value
  const filled = fill(help) as HelpContent
  return { ...filled, shortcuts: filled.shortcuts.filter((s) => s.keys.trim()) }
}

const cache: Partial<Record<'es' | 'en', HelpContent>> = {}
export const helpContent = (): HelpContent => {
  const lang = getLang()
  return (cache[lang] ??= forThisSystem(lang === 'en' ? HELP_EN : HELP_ES))
}

// The Discord invite from config/community.json, only if it really is one ('' = no button).
export const DISCORD_INVITE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(
  community.discordInvite
)
  ? community.discordInvite
  : ''

// Lowercase, no accents: "Cómo" and "como" are the same word.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Words that say nothing about the topic.
const STOP = new Set(
  (
    'que como donde cual para por con sin una uno los las del una mas pero esto esta este eso ese hay hago puedo puede quiero tengo nuggit ' +
    'the and for with without what how where which who why when can could does did are was this that these those there have has get from into you your just want'
  ).split(' ')
)

function words(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
}

export interface HelpEntry {
  title: string
  text: string
}

function entries(): Array<HelpEntry & { keywords: string[] }> {
  const help = helpContent()
  return [
    ...help.guides.map((g) => ({ title: g.title, text: g.text, keywords: g.keywords })),
    ...help.faq.map((f) => ({ title: f.q, text: f.a, keywords: f.keywords }))
  ]
}

// The help entries that best match a question, best first (keywords count the most).
export function searchHelp(query: string, limit = 3): HelpEntry[] {
  const asked = words(query)
  if (!asked.length) return []
  const has = (haystack: string, w: string): boolean => normalize(haystack).includes(w)
  return entries()
    .map((e) => {
      let score = 0
      for (const w of asked) {
        if (e.keywords.some((k) => has(k, w) || normalize(k).startsWith(w.slice(0, 5)))) score += 3
        if (has(e.title, w)) score += 2
        if (has(e.text, w)) score += 1
      }
      return { entry: { title: e.title, text: e.text }, score }
    })
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry)
}

// Questions about using the app ("¿cómo pongo un fondo?", "¿dónde cambio el tema?").
const HOW_TO =
  /\b(nuggit|como|donde|se puede|puedo|ajustes?|configur\w*|cambi\w*|pongo|quito|activ\w*|widgets?|pestanas?|tutorial|ayuda|atajos?|how|where|can i|settings?|change|turn on|turn off|enable|tabs?|help|shortcuts?)\b/

// What Dip gets to answer "¿cómo hago X en Nuggit?" with the same texts as the Ayuda tab.
// Only for questions that look like that, and only the matching entries, to keep it small.
export function helpForDip(question: string): string {
  if (!HOW_TO.test(normalize(question))) return ''
  const found = searchHelp(question)
  if (!found.length) return ''
  const lines = found.map((e) => `- ${e.title}: ${e.text.replace(/\*\*/g, '')}`)
  const header = t(
    'Ayuda de Nuggit (si la persona pregunta cómo usar la app, contesta con esto en tus palabras, corto; no inventes botones ni funciones que no estén aquí, y si no sabes, dile que lo busque en la pestaña Ayuda):',
    "Nuggit help (if the person asks how to use the app, answer with this in your own words, briefly; don't make up buttons or features that aren't here, and if you don't know, tell them to look it up in the Help tab):"
  )
  return `${header}\n${lines.join('\n')}`
}
