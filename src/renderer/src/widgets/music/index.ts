import type { WidgetDefinition } from '../types'
import { MusicWidget, type MusicConfig } from './MusicWidget'

export const musicWidget: WidgetDefinition<MusicConfig> = {
  type: 'music',
  name: 'Música',
  icon: '🎵',
  defaultSize: { w: 300, h: 320 },
  minSize: { w: 220, h: 150 },
  maxSize: { w: 700, h: 900 },
  defaultConfig: {},
  component: MusicWidget
}
