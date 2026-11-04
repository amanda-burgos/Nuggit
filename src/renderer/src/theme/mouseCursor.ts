// Fase 16: Vestidor del mouse. The cursors are drawn here as SVG (from the chosen colors)
// and used as CSS cursors (`url(data:…) x y, fallback`). CSS cursors only work inside
// Nuggit's own windows; outside them the computer shows its own cursor.
import type { MouseShape, MouseStyle } from '../../../shared/types'
import { MOUSE_SIZE_PX } from '../../../shared/types'
import { hasDetails } from '../../../shared/mouse'
import { luminance } from './appearance'

// Every shape is drawn in a 32×32 box; the image is then shown at the chosen size.
const BOX = 32

interface ShapeDef {
  silhouette: string[] // path data: filled with the fill color, outlined with the border
  hotspot: [number, number] // where the click lands, in box units
  details?: (color: string, border: string) => string // extra SVG on top
  round?: boolean // round joins (soft shapes)
}

const STAR = (cx: number, cy: number, R: number, r: number, points = 5): string => {
  const out: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? r : R
    const a = (Math.PI * i) / points - Math.PI / 2
    out.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`)
  }
  return `M${out.join(' L')} Z`
}

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`

export const SHAPES: Record<Exclude<MouseShape, 'system'>, ShapeDef> = {
  arrow: {
    silhouette: ['M4 2 L4 25 L9.6 19.8 L13.6 28.6 L17.6 26.8 L13.7 18.2 L21.5 18.2 Z'],
    hotspot: [4, 2]
  },
  'arrow-round': {
    silhouette: [
      'M5 3.5 C5 2.4 6.1 1.9 7 2.6 L24.6 16.4 C25.6 17.2 25.1 18.7 23.8 18.8 L16.4 19.4 L12.2 26.6 C11.6 27.7 10 27.5 9.8 26.2 Z'
    ],
    hotspot: [5, 3],
    round: true
  },
  pencil: {
    // Tip at the bottom left; the body goes up to the right.
    silhouette: ['M3 29 L6.16 20.84 L23.8 3.2 L28.8 8.2 L11.16 25.84 Z'],
    hotspot: [3, 29],
    details: (c, b) =>
      `<path d="M3 29 L4.4 25.4 L6.6 27.6 Z" fill="${c}"/>` +
      `<path d="M20.3 6.7 L23.8 3.2 L28.8 8.2 L25.3 11.7 Z" fill="${c}" stroke="${b}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M6.16 20.84 L11.16 25.84" stroke="${b}" stroke-width="1.2"/>`
  },
  plane: {
    silhouette: ['M3 3 L29 13 L17.5 16.5 L13 29 Z'],
    hotspot: [3, 3],
    details: (c, b) =>
      `<path d="M3 3 L17.5 16.5 L13 29 Z" fill="${c}" stroke="${b}" stroke-width="1.5" stroke-linejoin="round"/>`
  },
  star: {
    silhouette: [STAR(16, 17, 14, 6)],
    hotspot: [16, 17],
    round: true
  },
  heart: {
    silhouette: [
      'M16 28 C6.5 21.5 2.5 15.6 2.5 10.4 C2.5 6.1 5.7 3.2 9.4 3.2 C12.3 3.2 14.6 5 16 7.4 C17.4 5 19.7 3.2 22.6 3.2 C26.3 3.2 29.5 6.1 29.5 10.4 C29.5 15.6 25.5 21.5 16 28 Z'
    ],
    hotspot: [16, 15],
    round: true
  },
  dip: {
    // Dip's speech bubble with the lightning bolt (resources/icons/dip-icon.svg).
    silhouette: [
      'M6 4 H26 A4 4 0 0 1 30 8 V20 A4 4 0 0 1 26 24 H14 L8 29 V24 H6 A4 4 0 0 1 2 20 V8 A4 4 0 0 1 6 4 Z'
    ],
    hotspot: [16, 14],
    round: true,
    details: (c, b) =>
      `<path d="M18 7 L13 15 H17.5 L15.5 22 L21.5 13 H17 Z" fill="${c}" stroke="${b}" stroke-width="0.8" stroke-linejoin="round"/>`
  },
  kitty: {
    silhouette: [
      'M4 6 L11 10.2 C14.3 9.3 17.7 9.3 21 10.2 L28 6 L27.4 15 C29 17 29.6 19.3 29.2 21.6 C28.2 26.6 22.8 29.4 16 29.4 C9.2 29.4 3.8 26.6 2.8 21.6 C2.4 19.3 3 17 4.6 15 Z'
    ],
    hotspot: [16, 19],
    round: true,
    details: (c) =>
      `<path d="${circle(11, 19, 1.8)}" fill="${c}"/><path d="${circle(21, 19, 1.8)}" fill="${c}"/>` +
      `<path d="M14.6 22.4 H17.4 L16 24 Z" fill="${c}"/>` +
      `<path d="M2.5 21 L8.5 22 M2.8 25 L8.5 23.6 M29.5 21 L23.5 22 M29.2 25 L23.5 23.6" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>`
  },
  paw: {
    silhouette: [
      'M16 15 C21.5 15 25.5 20.5 25.5 24.4 C25.5 28 22.3 29 19.8 28.3 C18 27.8 17 27.3 16 27.3 C15 27.3 14 27.8 12.2 28.3 C9.7 29 6.5 28 6.5 24.4 C6.5 20.5 10.5 15 16 15 Z',
      circle(6.2, 13.6, 3.4),
      circle(12, 7.4, 3.6),
      circle(20, 7.4, 3.6),
      circle(25.8, 13.6, 3.4)
    ],
    hotspot: [16, 16],
    round: true,
    details: (c) =>
      `<path d="M16 18.6 C19.6 18.6 22.2 22 22.2 24.2 C22.2 25.6 20.9 26 19.6 25.6 C18.3 25.2 17.2 24.9 16 24.9 C14.8 24.9 13.7 25.2 12.4 25.6 C11.1 26 9.8 25.6 9.8 24.2 C9.8 22 12.4 18.6 16 18.6 Z" fill="${c}"/>` +
      [circle(6.2, 13.6, 1.8), circle(12, 7.4, 2), circle(20, 7.4, 2), circle(25.8, 13.6, 1.8)]
        .map((d) => `<path d="${d}" fill="${c}"/>`)
        .join('')
  },
  bolt: {
    silhouette: ['M19 2 L6 18 H14.5 L11.5 30 L26 13 H17.5 L21.5 2 Z'],
    hotspot: [16, 16]
  }
}

export type CursorKind = 'default' | 'pointer' | 'text' | 'grab' | 'grabbing' | 'resize'

const FALLBACK: Record<CursorKind, string> = {
  default: 'auto',
  pointer: 'pointer',
  text: 'text',
  grab: 'grab',
  grabbing: 'grabbing',
  resize: 'nwse-resize'
}

// WCAG contrast between two #rrggbb colors (1 = same, 21 = black on white).
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// An extra outline around the cursor when its border doesn't stand out from the fill or
// from the window's background, so you always see where you click. null = not needed.
export function outlineFor(colors: MouseStyle['colors'], background: string): string | null {
  const edge = colors.border
  const fills = [colors.fill, colors.fill2].filter((c): c is string => !!c)
  const weak = contrast(edge, background) < 1.6 || fills.some((fill) => contrast(fill, edge) < 1.6)
  if (!weak) return null
  // Black or white: whichever stands out most from both the edge and the background.
  const score = (c: string): number => Math.min(contrast(c, edge), contrast(c, background))
  return score('#111111') >= score('#ffffff') ? '#111111' : '#ffffff'
}

const pathEls = (paths: string[], attrs: string): string =>
  paths.map((d) => `<path d="${d}" ${attrs}/>`).join('')

// The I-beam, the move cross and the resize arrow, in the cursor's colors.
const EXTRA: Record<'text' | 'grab' | 'grabbing' | 'resize', ShapeDef> = {
  text: {
    silhouette: [
      'M10 3 H22 V7 H18 V25 H22 V29 H10 V25 H14 V7 H10 Z' // a chunky I-beam
    ],
    hotspot: [16, 16]
  },
  grab: {
    silhouette: [
      'M16 1.5 L21 7 H18 V14 H25 V11 L30.5 16 L25 21 V18 H18 V25 H21 L16 30.5 L11 25 H14 V18 H7 V21 L1.5 16 L7 11 V14 H14 V7 H11 Z'
    ],
    hotspot: [16, 16]
  },
  grabbing: {
    silhouette: [
      'M16 5 L20.5 10 H18 V14 H22 V11.5 L27 16 L22 20.5 V18 H18 V22 H20.5 L16 27 L11.5 22 H14 V18 H10 V20.5 L5 16 L10 11.5 V14 H14 V10 H11.5 Z'
    ],
    hotspot: [16, 16]
  },
  resize: {
    silhouette: ['M3 3 H13 L9.6 6.4 L25.6 22.4 L29 19 V29 H19 L22.4 25.6 L6.4 9.6 L3 13 Z'],
    hotspot: [16, 16]
  }
}

// The SVG for one kind of cursor (the image itself, at `size` px).
export function cursorSvg(
  mouse: MouseStyle,
  kind: CursorKind = 'default',
  background = '#f6f4fd'
): string {
  if (mouse.shape === 'system') return ''
  const size = MOUSE_SIZE_PX[mouse.size]
  const { colors } = mouse
  const shape = SHAPES[mouse.shape]
  const def = kind === 'default' || kind === 'pointer' ? shape : EXTRA[kind]
  const outline = outlineFor(colors, background)
  const join = `stroke-linejoin="round" stroke-linecap="round"`
  const gradient = colors.fill2
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.fill}"/><stop offset="1" stop-color="${colors.fill2}"/></linearGradient></defs>`
    : ''
  const fill = colors.fill2 ? 'url(#g)' : colors.fill
  let body = gradient
  if (outline)
    body += pathEls(
      def.silhouette,
      `fill="${outline}" stroke="${outline}" stroke-width="4.5" ${join}`
    )
  body += pathEls(
    def.silhouette,
    `fill="${fill}" stroke="${colors.border}" stroke-width="1.8" ${join}`
  )
  if (def === shape && shape.details && hasDetails(mouse.shape)) {
    body += shape.details(colors.details, colors.border)
  }
  if (kind === 'text' || kind === 'grabbing') {
    // A little dot of the details color: the same family as the main cursor.
    body += `<path d="${circle(16, 16, kind === 'text' ? 1.6 : 2.4)}" fill="${colors.details}"/>`
  }
  if (kind === 'pointer') {
    // "You can click here": a small accent dot with a ring, at the bottom right.
    const ring = outline ?? colors.border
    body += `<path d="${circle(26.5, 26.5, 4.4)}" fill="${ring}"/>`
    body += `<path d="${circle(26.5, 26.5, 3)}" fill="${colors.details}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${BOX} ${BOX}">${body}</svg>`
}

// Where the click lands, in pixels of the image.
export function cursorHotspot(mouse: MouseStyle, kind: CursorKind = 'default'): [number, number] {
  if (mouse.shape === 'system') return [0, 0]
  const size = MOUSE_SIZE_PX[mouse.size]
  const def = kind === 'default' || kind === 'pointer' ? SHAPES[mouse.shape] : EXTRA[kind]
  const scale = size / BOX
  const clamp = (v: number): number => Math.min(size - 1, Math.max(0, Math.round(v * scale)))
  return [clamp(def.hotspot[0]), clamp(def.hotspot[1])]
}

export const svgDataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`

// The CSS `cursor` value for one kind, e.g. `url("data:…") 4 2, pointer`. null = system.
export function cursorCss(
  mouse: MouseStyle,
  kind: CursorKind = 'default',
  background?: string
): string | null {
  if (mouse.shape === 'system') return null
  const [x, y] = cursorHotspot(mouse, kind)
  return `url("${svgDataUrl(cursorSvg(mouse, kind, background))}") ${x} ${y}, ${FALLBACK[kind]}`
}

export const CURSOR_KINDS: CursorKind[] = [
  'default',
  'pointer',
  'text',
  'grab',
  'grabbing',
  'resize'
]

// All the cursors at once, as the CSS variables main.css uses (--cur-default…).
export function cursorVars(mouse: MouseStyle, background?: string): Record<string, string> {
  if (mouse.shape === 'system') return {}
  return Object.fromEntries(
    CURSOR_KINDS.map((kind) => [`--cur-${kind}`, cursorCss(mouse, kind, background)!])
  )
}

// The window's background, to decide on the outline: Mi color, or light/dark.
export function cursorBackground(
  themeColor: string | undefined,
  theme: string | undefined
): string {
  if (themeColor) return themeColor
  const dark =
    theme === 'dark' ||
    (theme !== 'light' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-color-scheme: dark)').matches)
  return dark ? '#141a33' : '#f6f4fd'
}

// Puts the cursors on <html> in this window (every window calls this from AppearanceRoot).
export function applyMouseCursor(mouse: MouseStyle | undefined, background: string): void {
  const html = document.documentElement
  for (const kind of CURSOR_KINDS) html.style.removeProperty(`--cur-${kind}`)
  if (!mouse || mouse.shape === 'system') {
    html.classList.remove('has-mouse-style')
    return
  }
  for (const [key, value] of Object.entries(cursorVars(mouse, background))) {
    html.style.setProperty(key, value)
  }
  html.classList.add('has-mouse-style')
}
