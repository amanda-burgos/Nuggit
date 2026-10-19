import type { WidgetDefinition } from '../types'
import { BrainDumpWidget, type BrainDumpConfig } from './BrainDumpWidget'

export const brainDumpWidget: WidgetDefinition<BrainDumpConfig> = {
  type: 'brain-dump',
  name: 'Brain Dump',
  icon: '🌪️',
  defaultSize: { w: 360, h: 420 },
  minSize: { w: 260, h: 240 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: BrainDumpWidget
}
