import type { AppearanceSettings, Background } from '../../../shared/types'
import { fontStack } from './fonts'
import { t } from '../../../shared/i18n'

// Fase 9: Ajustes → Apariencia applied as CSS variables, so every window (the board,
// detached widgets, the menu bar windows) looks the same and follows light/dark.

export const ACCENT_PRESETS: Record<string, { name: string; light: string; dark: string }> = {
  lavender: {
    get name() {
      return t('Lavanda', 'Lavender')
    },
    light: '#8b72dd',
    dark: '#a994ec'
  },
  blue: {
    get name() {
      return t('Azul', 'Blue')
    },
    light: '#4f7cf0',
    dark: '#7fa2ff'
  },
  mint: {
    get name() {
      return t('Menta', 'Mint')
    },
    light: '#23977f',
    dark: '#5fd3b7'
  },
  peach: {
    get name() {
      return t('Durazno', 'Peach')
    },
    light: '#e5763f',
    dark: '#ffab85'
  },
  rose: {
    get name() {
      return t('Rosa', 'Pink')
    },
    light: '#d9508f',
    dark: '#ff8dbf'
  },
  sun: {
    get name() {
      return t('Sol', 'Sun')
    },
    light: '#c18a0c',
    dark: '#f5c84c'
  }
}

export const imageUrl = (name: string): string => `nuggit-img://image/${encodeURIComponent(name)}`

// Relative luminance of a #rrggbb color (0 = black, 1 = white).
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Text that reads well on that color.
export function textOn(hex: string): { text: string; muted: string } {
  return luminance(hex) > 0.4
    ? { text: '#1b2346', muted: '#4a4f6a' }
    : { text: '#f7f5ff', muted: '#d2cee8' }
}

// The variables a background sets on a widget: color, picture, and the veil over a
// picture that keeps the text readable (made of the theme's surface, so light or dark).
export function backgroundVars(background: Background): Record<string, string> {
  if (background.kind === 'color') {
    const { text, muted } = textOn(background.color)
    return {
      '--widget-bg': background.color,
      '--widget-image': 'none',
      '--widget-scrim': 'transparent',
      '--color-text': text,
      '--color-text-muted': muted
    }
  }
  if (background.kind === 'image') {
    return {
      '--widget-image': `url("${imageUrl(background.image)}")`,
      '--widget-scrim': 'color-mix(in srgb, var(--color-surface) 72%, transparent)'
    }
  }
  return {}
}

// Tema "Mi color": darker colors get light text and a dark base (where both texts read equally).
export const isDarkColor = (hex: string): boolean => luminance(hex) < 0.215

// The theme tokens (tokens.css) made from one color: the window is that color, the cards a
// bit lighter, the text light or dark to match.
function themeVars(hex: string): Record<string, string> {
  const mix = (a: string, pct: number, b: string): string =>
    `color-mix(in srgb, ${a} ${pct}%, ${b})`
  if (isDarkColor(hex)) {
    return {
      '--color-bg': hex,
      '--color-surface': mix(hex, 90, '#ffffff'),
      '--color-surface-muted': mix(hex, 80, '#ffffff'),
      '--color-border': mix(hex, 66, '#ffffff'),
      '--color-text': '#f7f5ff',
      '--color-text-muted': mix('#f7f5ff', 68, hex),
      '--color-accent-soft': mix('var(--color-accent)', 30, 'var(--color-surface)')
    }
  }
  return {
    '--color-bg': hex,
    '--color-surface': mix(hex, 30, '#ffffff'),
    '--color-surface-muted': mix(hex, 60, '#ffffff'),
    '--color-border': mix(hex, 82, '#1b2346'),
    '--color-text': '#1b2346',
    '--color-text-muted': mix('#1b2346', 72, hex),
    '--color-accent-soft': mix('var(--color-accent)', 24, 'var(--color-surface)')
  }
}

const THEME_KEYS = Object.keys(themeVars('#000000'))

export function applyAppearance(appearance: AppearanceSettings): void {
  const root = document.documentElement.style
  const preset = ACCENT_PRESETS[appearance.accent]
  const light = preset?.light ?? appearance.accent
  const dark = preset?.dark ?? appearance.accent
  root.setProperty('--accent-light', light)
  root.setProperty('--accent-dark', dark)
  root.setProperty('--on-accent-light', luminance(light) > 0.4 ? '#1b2346' : '#ffffff')
  // In dark mode the accents are lighter, so dark text reads better on them sooner.
  root.setProperty('--on-accent-dark', luminance(dark) > 0.3 ? '#141a33' : '#ffffff')

  const { board } = appearance
  root.setProperty('--board-bg', board.kind === 'color' ? board.color : 'transparent')
  root.setProperty(
    '--board-image',
    board.kind === 'image' ? `url("${imageUrl(board.image)}")` : 'none'
  )

  root.setProperty('--board-opacity', String(appearance.boardOpacity ?? 1))

  // Set on the root element, these win over tokens.css; without a color, tokens.css applies.
  if (appearance.themeColor) {
    for (const [key, value] of Object.entries(themeVars(appearance.themeColor))) {
      root.setProperty(key, value)
    }
  } else {
    for (const key of THEME_KEYS) root.removeProperty(key)
  }

  root.setProperty('--widget-radius', `${appearance.widgetRadius ?? 18}px`)
  root.setProperty('--widget-shadow', appearance.widgetShadow ? 'var(--shadow-widget)' : 'none')
  root.setProperty('--widget-opacity', `${Math.round(appearance.widgetOpacity * 100)}%`)

  // Fase 13: fonts and text size (sizes in the CSS are rem, so they all follow).
  root.setProperty('--font-sans', fontStack(appearance.font))
  root.setProperty('--font-heading', fontStack(appearance.headingFont ?? appearance.font))
  // "Ajustar al tamaño de la ventana": in the main window the base size goes from 13 px
  // (narrow) to 17 px (wide), about 16 px at 1280 px. Detached widgets and the menu bar
  // windows are small on purpose, so they keep the normal size.
  const scale = appearance.fontScale ?? 1
  const mainWindow = !location.search
  root.fontSize =
    appearance.fontAuto !== false && mainWindow
      ? `calc(${scale} * clamp(13px, 0.55vw + 9px, 17px))`
      : `${Math.round(scale * 100)}%`
}

// A widget's own font (Fase 13), over the general one: its text and its titles.
export function widgetFontVars(font: string | undefined): Record<string, string> {
  if (!font) return {}
  const stack = fontStack(font)
  return { '--font-sans': stack, '--font-heading': stack }
}
