import type { WidgetDefinition } from '../types'
import { DailiesWidget, type DailiesConfig } from './DailiesWidget'

export const dailiesWidget: WidgetDefinition<DailiesConfig> = {
  type: 'dailies',
  name: 'Dailies',
  icon: '🔁',
  defaultSize: { w: 340, h: 420 },
  minSize: { w: 260, h: 240 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: DailiesWidget
}
