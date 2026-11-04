import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { NextActionWidget, type NextActionConfig } from './NextActionWidget'

export const nextActionWidget: WidgetDefinition<NextActionConfig> = {
  type: 'next-action',
  get name() {
    return t('¿Qué hago ahora?', 'What do I do now?')
  },
  icon: '🎯',
  defaultSize: { w: 360, h: 420 },
  minSize: { w: 260, h: 220 },
  maxSize: { w: 900, h: 1200 },
  defaultConfig: {},
  component: NextActionWidget
}
