import type { WidgetDefinition } from '../types'
import { CalendarWidget, type CalendarConfig } from './CalendarWidget'

export const calendarWidget: WidgetDefinition<CalendarConfig> = {
  type: 'calendar',
  name: 'Calendario',
  icon: '📅',
  defaultSize: { w: 360, h: 420 },
  minSize: { w: 260, h: 260 },
  maxSize: { w: 1400, h: 1400 },
  defaultConfig: {},
  component: CalendarWidget
}
