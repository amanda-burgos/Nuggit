import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { ClockSettings, ClockWidget, type ClockConfig } from './ClockWidget'

export const clockWidget: WidgetDefinition<ClockConfig> = {
  type: 'clock',
  get name() {
    return t('Reloj', 'Clock')
  },
  icon: '🕒',
  defaultSize: { w: 360, h: 192 },
  minSize: { w: 180, h: 110 },
  maxSize: { w: 960, h: 400 },
  defaultConfig: { showSeconds: false, hour12: false },
  component: ClockWidget,
  settingsComponent: ClockSettings
}
