import type { WidgetDefinition } from '../types'
import { ClockSettings, ClockWidget, type ClockConfig } from './ClockWidget'

export const clockWidget: WidgetDefinition<ClockConfig> = {
  type: 'clock',
  name: 'Reloj',
  icon: '🕒',
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 8, h: 6 },
  defaultConfig: { showSeconds: false, hour12: false },
  component: ClockWidget,
  settingsComponent: ClockSettings
}
