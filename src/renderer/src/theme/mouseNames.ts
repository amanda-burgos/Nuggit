// Fase 16: what the dress-up calls each shape and trail style (in the current language).
import type { MouseShape, MouseSize, TrailColorMode, TrailStyle } from '../../../shared/types'
import { t } from '../../../shared/i18n'

export const ALL_SHAPES: MouseShape[] = [
  'system',
  'arrow',
  'arrow-round',
  'pencil',
  'plane',
  'star',
  'heart',
  'dip',
  'kitty',
  'paw',
  'bolt'
]

export function shapeName(shape: MouseShape): string {
  switch (shape) {
    case 'system':
      return t('Normal del sistema', 'System default')
    case 'arrow':
      return t('Flecha', 'Arrow')
    case 'arrow-round':
      return t('Flecha redondita', 'Round arrow')
    case 'pencil':
      return t('Lápiz', 'Pencil')
    case 'plane':
      return t('Avión de papel', 'Paper plane')
    case 'star':
      return t('Estrella', 'Star')
    case 'heart':
      return t('Corazón', 'Heart')
    case 'dip':
      return t('Burbuja de Dip', "Dip's bubble")
    case 'kitty':
      return t('Gatito', 'Kitty')
    case 'paw':
      return t('Pata de gato', 'Cat paw')
    case 'bolt':
      return t('Rayo', 'Lightning')
  }
}

export function trailName(style: TrailStyle): string {
  switch (style) {
    case 'sparkles':
      return t('✨ Brillitos', '✨ Sparkles')
    case 'stars':
      return t('⭐ Estrellitas', '⭐ Little stars')
    case 'hearts':
      return t('💗 Corazoncitos', '💗 Little hearts')
    case 'paws':
      return t('🐾 Patitas de gato', '🐾 Kitty paws')
    case 'dots':
      return t('• Puntitos', '• Dots')
    case 'bubbles':
      return t('🫧 Burbujitas', '🫧 Bubbles')
    case 'comet':
      return t('☄️ Cometa', '☄️ Comet')
    case 'rainbow':
      return t('🌈 Arcoíris', '🌈 Rainbow')
  }
}

export function sizeName(size: MouseSize): string {
  if (size === 'small') return t('Chico', 'Small')
  if (size === 'large') return t('Grande', 'Large')
  return t('Mediano', 'Medium')
}

export function modeName(mode: TrailColorMode): string {
  if (mode === 'alternate') return t('Varios colores', 'Several colors')
  if (mode === 'rainbow') return t('Arcoíris', 'Rainbow')
  return t('Un color', 'One color')
}
