import type { WidgetDefinition } from '../types'
import { FocusWidget, type FocusConfig } from './FocusWidget'

export const focusWidget: WidgetDefinition<FocusConfig> = {
  type: 'focus',
  name: 'Focus',
  icon: '⏳',
  defaultSize: { w: 320, h: 380 },
  minSize: { w: 240, h: 260 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: FocusWidget
}
