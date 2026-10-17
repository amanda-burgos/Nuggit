import type { WidgetDefinition } from '../types'
import { TendersWidget, type TendersConfig } from './TendersWidget'

export const tendersWidget: WidgetDefinition<TendersConfig> = {
  type: 'tenders',
  name: 'Tenderizer',
  icon: '🪜',
  defaultSize: { w: 400, h: 520 },
  minSize: { w: 280, h: 300 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: TendersWidget
}
