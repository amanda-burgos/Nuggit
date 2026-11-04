import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { ImageSettings } from './ImageSettings'
import { ImageWidget, type ImageConfig } from './ImageWidget'

export const imageWidget: WidgetDefinition<ImageConfig> = {
  type: 'image',
  get name() {
    return t('Imagen', 'Image')
  },
  icon: '🖼️',
  defaultSize: { w: 280, h: 280 },
  minSize: { w: 120, h: 120 },
  maxSize: { w: 1600, h: 1400 },
  defaultConfig: { images: [], intervalSec: 30, fit: 'cover' },
  component: ImageWidget,
  settingsComponent: ImageSettings
}
