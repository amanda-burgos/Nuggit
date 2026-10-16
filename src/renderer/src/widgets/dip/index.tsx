import { DipIcon } from '../../theme/DipIcon'
import type { WidgetDefinition } from '../types'
import { DipWidget, type DipConfig } from './DipWidget'

export const dipWidget: WidgetDefinition<DipConfig> = {
  type: 'dip',
  name: 'Dip',
  icon: <DipIcon />,
  defaultSize: { w: 360, h: 440 },
  minSize: { w: 260, h: 240 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: DipWidget,
  needsAI: true
}
