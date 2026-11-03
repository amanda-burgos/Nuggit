import type { AnyWidgetDefinition } from './types'
import { brainDumpWidget } from './brain-dump'
import { calendarWidget } from './calendar'
import { clockWidget } from './clock'
import { dailiesWidget } from './dailies'
import { dipWidget } from './dip'
import { focusWidget } from './focus'
import { imageWidget } from './image'
import { musicWidget } from './music'
import { nextActionWidget } from './next-action'
import { notesWidget } from './notes'
import { qotdWidget } from './qotd'
import { remindersWidget } from './reminders'
import { tasksWidget } from './tasks'
import { tendersWidget } from './tenders'

// Every available widget. Adding a widget = create its folder + add it here.
export const widgetRegistry: AnyWidgetDefinition[] = [
  nextActionWidget,
  focusWidget,
  musicWidget,
  imageWidget,
  clockWidget,
  tasksWidget,
  tendersWidget,
  dailiesWidget,
  remindersWidget,
  calendarWidget,
  notesWidget,
  qotdWidget,
  brainDumpWidget,
  dipWidget
]

export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  return widgetRegistry.find((def) => def.type === type)
}

// Grid units and widget sizes must never hot-swap into a running desktop (the saved layout
// would be read with the wrong scale and overwritten). Reload the page from disk instead.
import.meta.hot?.accept(() => window.location.reload())
