import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { QotdSettings, QotdWidget, type QotdConfig } from './QotdWidget'

export const qotdWidget: WidgetDefinition<QotdConfig> = {
  type: 'qotd',
  get name() {
    return t('Pregunta del día', 'Question of the day')
  },
  icon: '💭',
  defaultSize: { w: 320, h: 300 },
  minSize: { w: 240, h: 220 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: QotdWidget,
  settingsComponent: QotdSettings
}
