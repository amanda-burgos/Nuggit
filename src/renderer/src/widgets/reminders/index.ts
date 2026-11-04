import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { RemindersWidget, type RemindersConfig } from './RemindersWidget'

export const remindersWidget: WidgetDefinition<RemindersConfig> = {
  type: 'reminders',
  get name() {
    return t('Recordatorios', 'Reminders')
  },
  icon: '⏰',
  defaultSize: { w: 320, h: 340 },
  minSize: { w: 240, h: 220 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: RemindersWidget
}
