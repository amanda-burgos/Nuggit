import type { WidgetDefinition } from '../types'
import { NextActionWidget, type NextActionConfig } from './NextActionWidget'

export const nextActionWidget: WidgetDefinition<NextActionConfig> = {
  type: 'next-action',
  name: '¿Qué hago ahora?',
  icon: '🎯',
  defaultSize: { w: 360, h: 420 },
  minSize: { w: 260, h: 220 },
  maxSize: { w: 900, h: 1200 },
  defaultConfig: {},
  component: NextActionWidget
}
