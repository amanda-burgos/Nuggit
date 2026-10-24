import type { AppearanceSettings, Background, WidgetCorners } from '../../../shared/types'

// Fase 9: Ajustes → Apariencia applied as CSS variables, so every window (the board,
// detached widgets, the menu bar windows) looks the same and follows light/dark.

export const ACCENT_PRESETS: Record<string, { name: string; light: string; dark: string }> = {
  lavender: { name: 'Lavanda', light: '#8b72dd', dark: '#a994ec' },
  blue: { name: 'Azul', light: '#4f7cf0', dark: '#7fa2ff' },
  mint: { name: 'Menta', light: '#23977f', dark: '#5fd3b7' },
  peach: { name: 'Durazno', light: '#e5763f', dark: '#ffab85' },
  rose: { name: 'Rosa', light: '#d9508f', dark: '#ff8dbf' },
  sun: { name: 'Sol', light: '#c18a0c', dark: '#f5c84c' }
}

const RADIUS: Record<WidgetCorners, string> = { square: '6px', soft: '18px', round: '28px' }

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

  root.setProperty('--widget-radius', RADIUS[appearance.widgetCorners] ?? RADIUS.soft)
  root.setProperty('--widget-shadow', appearance.widgetShadow ? 'var(--shadow-widget)' : 'none')
  root.setProperty('--widget-opacity', `${Math.round(appearance.widgetOpacity * 100)}%`)
}
