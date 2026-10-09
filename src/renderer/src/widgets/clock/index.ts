import type { WidgetDefinition } from '../types'
import { ClockSettings, ClockWidget, type ClockConfig } from './ClockWidget'

export const clockWidget: WidgetDefinition<ClockConfig> = {
  type: 'clock',
  name: 'Reloj',
  icon: '🕒',
  defaultSize: { w: 9, h: 8 },
  minSize: { w: 5, h: 5 },
  maxSize: { w: 24, h: 16 },
  defaultConfig: { showSeconds: false, hour12: false },
  component: ClockWidget,
  settingsComponent: ClockSettings
}
