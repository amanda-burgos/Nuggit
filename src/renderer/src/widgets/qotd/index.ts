import type { WidgetDefinition } from '../types'
import { QotdSettings, QotdWidget, type QotdConfig } from './QotdWidget'

export const qotdWidget: WidgetDefinition<QotdConfig> = {
  type: 'qotd',
  name: 'Pregunta del día',
  icon: '💭',
  defaultSize: { w: 320, h: 300 },
  minSize: { w: 240, h: 220 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: QotdWidget,
  settingsComponent: QotdSettings
}
