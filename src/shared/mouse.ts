// Fase 16: Vestidor del mouse. The data side, shared by the main process (checks what is
// saved) and the windows: defaults, the quick colors, cleaning and the 🎲 random combo.
import {
  MOUSE_FAVORITES_MAX,
  MOUSE_NAME_MAX,
  MOUSE_SHAPES,
  TRAIL_LENGTH_MAX,
  TRAIL_LENGTH_MIN,
  TRAIL_MAX_COLORS,
  TRAIL_MAX_STYLES,
  TRAIL_STYLES,
  type MouseFavorite,
  type MouseShape,
  type MouseSize,
  type MouseStyle,
  type TrailColorMode,
  type TrailLayer,
  type TrailStyle
} from './types'
import { t } from './i18n'

const HEX = /^#[0-9a-f]{6}$/i
const SIZES: MouseSize[] = ['small', 'medium', 'large']
const MODES: TrailColorMode[] = ['one', 'alternate', 'rainbow']

// The shapes that have a part with its own "detalles" color.
export const SHAPES_WITH_DETAILS: MouseShape[] = ['pencil', 'plane', 'dip', 'kitty', 'paw']
export const hasDetails = (shape: MouseShape): boolean => SHAPES_WITH_DETAILS.includes(shape)

// Nothing changes for anyone until they dress the mouse up.
export const DEFAULT_MOUSE: MouseStyle = {
  shape: 'system',
  size: 'medium',
  colors: { fill: '#8b72dd', border: '#ffffff', details: '#f5c84c' },
  trail: {
    on: false,
    styles: [{ style: 'sparkles', mode: 'one', colors: ['#f5c84c'] }],
    length: 5,
    fade: 'slow'
  },
  typingPause: true,
  focusPause: true
}

export const defaultMouse = (): MouseStyle => structuredClone(DEFAULT_MOUSE)

// The quick base colors (the accent one is added by the window, from the current accent).
export const QUICK_COLORS: Array<{ id: string; hex: string; name(): string }> = [
  { id: 'red', hex: '#ef4444', name: () => t('Rojo', 'Red') },
  { id: 'orange', hex: '#f97316', name: () => t('Naranja', 'Orange') },
  { id: 'yellow', hex: '#facc15', name: () => t('Amarillo', 'Yellow') },
  { id: 'green', hex: '#22c55e', name: () => t('Verde', 'Green') },
  { id: 'blue', hex: '#3b82f6', name: () => t('Azul', 'Blue') },
  { id: 'purple', hex: '#8b5cf6', name: () => t('Morado', 'Purple') },
  { id: 'pink', hex: '#ec4899', name: () => t('Rosado', 'Pink') },
  { id: 'white', hex: '#ffffff', name: () => t('Blanco', 'White') },
  { id: 'black', hex: '#111111', name: () => t('Negro', 'Black') }
]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const hex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback

function cleanLayer(value: unknown): TrailLayer | null {
  if (!isObject(value) || !TRAIL_STYLES.includes(value.style as TrailStyle)) return null
  const colors = (Array.isArray(value.colors) ? value.colors : [])
    .filter((c): c is string => typeof c === 'string' && HEX.test(c))
    .map((c) => c.toLowerCase())
    .slice(0, TRAIL_MAX_COLORS)
  return {
    style: value.style as TrailStyle,
    mode: oneOf(value.mode, MODES, 'one'),
    colors: colors.length ? colors : ['#f5c84c']
  }
}

// Whatever was saved (or sent), as a valid MouseStyle: unknown parts get the defaults.
export function cleanMouse(value: unknown): MouseStyle {
  const d = DEFAULT_MOUSE
  if (!isObject(value)) return defaultMouse()
  const colors = isObject(value.colors) ? value.colors : {}
  const trail = isObject(value.trail) ? value.trail : {}
  const seen = new Set<TrailStyle>()
  const styles = (Array.isArray(trail.styles) ? trail.styles : [])
    .map(cleanLayer)
    .filter((l): l is TrailLayer => !!l && !seen.has(l.style) && !!seen.add(l.style))
    .slice(0, TRAIL_MAX_STYLES)
  const length =
    typeof trail.length === 'number' && Number.isFinite(trail.length)
      ? Math.min(TRAIL_LENGTH_MAX, Math.max(TRAIL_LENGTH_MIN, Math.round(trail.length)))
      : d.trail.length
  const mouse: MouseStyle = {
    shape: value.shape === 'system' ? 'system' : oneOf(value.shape, MOUSE_SHAPES, 'system'),
    size: oneOf(value.size, SIZES, d.size),
    colors: {
      fill: hex(colors.fill, d.colors.fill),
      border: hex(colors.border, d.colors.border),
      details: hex(colors.details, d.colors.details)
    },
    trail: {
      on: typeof trail.on === 'boolean' ? trail.on : false,
      styles: styles.length ? styles : structuredClone(d.trail.styles),
      length,
      fade: trail.fade === 'fast' ? 'fast' : 'slow'
    },
    typingPause: typeof value.typingPause === 'boolean' ? value.typingPause : true,
    focusPause: typeof value.focusPause === 'boolean' ? value.focusPause : true
  }
  if (typeof colors.fill2 === 'string' && HEX.test(colors.fill2)) {
    mouse.colors.fill2 = colors.fill2.toLowerCase()
  }
  return mouse
}

export function cleanMouseName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim().slice(0, MOUSE_NAME_MAX).trim()
  return name || null
}

// The saved favorites, or null if it isn't a list at all.
export function cleanMouseFavorites(value: unknown): MouseFavorite[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<string>()
  const out: MouseFavorite[] = []
  for (const item of value) {
    if (!isObject(item)) continue
    const name = cleanMouseName(item.name)
    const id = typeof item.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(item.id) ? item.id : null
    if (!name || !id || ids.has(id)) continue
    ids.add(id)
    out.push({ id, name, style: cleanMouse(item.style) })
    if (out.length >= MOUSE_FAVORITES_MAX) break
  }
  return out
}

// 🎲 Sorpréndeme: a random dressed-up mouse (never the system one), trail on.
export function randomMouse(random: () => number = Math.random): MouseStyle {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length]
  const palette = QUICK_COLORS.map((c) => c.hex)
  const fill = pick(palette)
  const others = palette.filter((c) => c !== fill)
  const border = random() < 0.5 ? '#ffffff' : pick(others)
  const count = random() < 0.5 ? 1 : 2
  const styles: TrailLayer[] = []
  const free = [...TRAIL_STYLES]
  for (let i = 0; i < count; i++) {
    const style = free.splice(Math.floor(random() * free.length) % free.length, 1)[0]
    const mode = pick(MODES)
    const colors =
      mode === 'alternate' ? [pick(palette), pick(others), pick(palette)] : [pick(palette)]
    styles.push({ style, mode, colors })
  }
  const mouse: MouseStyle = {
    shape: pick(MOUSE_SHAPES),
    size: pick(SIZES),
    colors: { fill, border, details: pick(others) },
    trail: {
      on: true,
      styles,
      length: TRAIL_LENGTH_MIN + (Math.floor(random() * TRAIL_LENGTH_MAX) % TRAIL_LENGTH_MAX),
      fade: random() < 0.5 ? 'fast' : 'slow'
    },
    typingPause: true,
    focusPause: true
  }
  if (random() < 0.3) mouse.colors.fill2 = pick(others)
  return mouse
}

// Ready-made combos shown in ⭐ Favoritos as ideas (they can't be deleted, only used).
export function exampleFavorites(): MouseFavorite[] {
  return [
    {
      id: 'example-kitty',
      name: t('Modo gatito 🐾', 'Kitty mode 🐾'),
      style: {
        ...defaultMouse(),
        shape: 'paw',
        size: 'large',
        colors: { fill: '#ffffff', border: '#ec4899', details: '#f9a8d4' },
        trail: {
          on: true,
          styles: [
            { style: 'paws', mode: 'one', colors: ['#ec4899'] },
            { style: 'hearts', mode: 'alternate', colors: ['#f9a8d4', '#ec4899'] }
          ],
          length: 6,
          fade: 'slow'
        }
      }
    },
    {
      id: 'example-galaxy',
      name: t('Galaxia ✨', 'Galaxy ✨'),
      style: {
        ...defaultMouse(),
        shape: 'star',
        size: 'medium',
        colors: { fill: '#8b5cf6', fill2: '#3b82f6', border: '#ffffff', details: '#facc15' },
        trail: {
          on: true,
          styles: [
            { style: 'sparkles', mode: 'alternate', colors: ['#facc15', '#ffffff', '#a78bfa'] },
            { style: 'stars', mode: 'one', colors: ['#8b5cf6'] }
          ],
          length: 7,
          fade: 'slow'
        }
      }
    },
    {
      id: 'example-dip',
      name: t('Dip eléctrico ⚡', 'Electric Dip ⚡'),
      style: {
        ...defaultMouse(),
        shape: 'dip',
        size: 'medium',
        colors: { fill: '#a994ec', border: '#141a33', details: '#f5c84c' },
        trail: {
          on: true,
          styles: [{ style: 'comet', mode: 'one', colors: ['#f5c84c'] }],
          length: 5,
          fade: 'fast'
        }
      }
    }
  ]
}
