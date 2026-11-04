// Fase 13: the fonts you can pick in Ajustes → Apariencia → Letra and in each widget's ⚙︎.
// The bundled ones come with Nuggit (no internet needed); "mac:<family>" is any font
// installed on this Mac.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/lexend/latin-400.css'
import '@fontsource/lexend/latin-700.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/opendyslexic/latin-400.css'
import '@fontsource/opendyslexic/latin-700.css'
import '@fontsource/comic-neue/latin-400.css'
import '@fontsource/comic-neue/latin-700.css'
import '@fontsource/fredoka/latin-400.css'
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-700.css'
import { DEFAULT_FONT } from '../../../shared/types'

const SYSTEM =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export interface FontPreset {
  id: string
  name: { es: string; en: string }
  hint: { es: string; en: string }
  stack: string
}

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'system',
    name: { es: 'Del sistema', en: 'System' },
    hint: { es: 'La de macOS (San Francisco)', en: "macOS's own (San Francisco)" },
    stack: SYSTEM
  },
  {
    id: 'rounded',
    name: { es: 'Redondeada', en: 'Rounded' },
    hint: { es: 'San Francisco con puntas suaves', en: 'San Francisco with soft ends' },
    stack: `ui-rounded, 'SF Pro Rounded', ${SYSTEM}`
  },
  {
    id: 'serif',
    name: { es: 'Con serifa', en: 'Serif' },
    hint: { es: 'New York, como un libro', en: 'New York, like a book' },
    stack: `ui-serif, 'New York', Georgia, serif`
  },
  {
    id: 'mono',
    name: { es: 'Monoespaciada', en: 'Monospace' },
    hint: { es: 'Como de código', en: 'Like code' },
    stack: `ui-monospace, 'SF Mono', Menlo, monospace`
  },
  {
    id: 'inter',
    name: { es: 'Inter', en: 'Inter' },
    hint: { es: 'Limpia y moderna', en: 'Clean and modern' },
    stack: `'Inter', ${SYSTEM}`
  },
  {
    id: 'nunito',
    name: { es: 'Nunito', en: 'Nunito' },
    hint: { es: 'Redonda y amigable', en: 'Round and friendly' },
    stack: `'Nunito', ${SYSTEM}`
  },
  {
    id: 'fredoka',
    name: { es: 'Fredoka', en: 'Fredoka' },
    hint: { es: 'Gordita y divertida', en: 'Chunky and fun' },
    stack: `'Fredoka', ${SYSTEM}`
  },
  {
    id: 'lexend',
    name: { es: 'Lexend', en: 'Lexend' },
    hint: { es: 'Hecha para leer más fácil', en: 'Made for easier reading' },
    stack: `'Lexend', ${SYSTEM}`
  },
  {
    id: 'atkinson',
    name: { es: 'Atkinson Hyperlegible', en: 'Atkinson Hyperlegible' },
    hint: { es: 'Letras que no se confunden', en: "Letters you can't mix up" },
    stack: `'Atkinson Hyperlegible', ${SYSTEM}`
  },
  {
    id: 'opendyslexic',
    name: { es: 'OpenDyslexic', en: 'OpenDyslexic' },
    hint: { es: 'Pensada para dislexia', en: 'Designed for dyslexia' },
    stack: `'OpenDyslexic', ${SYSTEM}`
  },
  {
    id: 'comic-neue',
    name: { es: 'Comic Neue', en: 'Comic Neue' },
    hint: { es: 'Como de cómic, pero bonita', en: 'Comic-style, but nice' },
    stack: `'Comic Neue', ${SYSTEM}`
  },
  {
    id: 'caveat',
    name: { es: 'Caveat', en: 'Caveat' },
    hint: { es: 'Escrita a mano', en: 'Handwritten' },
    stack: `'Caveat', ${SYSTEM}`
  },
  {
    id: 'merriweather',
    name: { es: 'Merriweather', en: 'Merriweather' },
    hint: { es: 'Serifa cómoda para leer', en: 'A comfy serif for reading' },
    stack: `'Merriweather', Georgia, serif`
  },
  {
    id: 'space-grotesk',
    name: { es: 'Space Grotesk', en: 'Space Grotesk' },
    hint: { es: 'Geométrica, con estilo', en: 'Geometric, with style' },
    stack: `'Space Grotesk', ${SYSTEM}`
  }
]

export const MAC_PREFIX = 'mac:'

// The CSS font-family for a choice; anything unknown falls back to the system font.
export function fontStack(id: string | undefined): string {
  if (id?.startsWith(MAC_PREFIX)) {
    const family = id.slice(MAC_PREFIX.length).replace(/["\\]/g, '')
    return `"${family}", ${SYSTEM}`
  }
  return (FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0]).stack
}

// What to call a choice in the UI.
export function fontName(id: string | undefined, lang: 'es' | 'en'): string {
  if (id?.startsWith(MAC_PREFIX)) return id.slice(MAC_PREFIX.length)
  return (FONT_PRESETS.find((f) => f.id === id) ?? FONT_PRESETS[0]).name[lang]
}

export { DEFAULT_FONT }
