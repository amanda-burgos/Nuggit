import type { AnyWidgetDefinition } from './types'
import { clockWidget } from './clock'
import { dipWidget } from './dip'
import { nextActionWidget } from './next-action'
import { tasksWidget } from './tasks'
import { tendersWidget } from './tenders'

// Every available widget. Adding a widget = create its folder + add it here.
export const widgetRegistry: AnyWidgetDefinition[] = [
  nextActionWidget,
  clockWidget,
  tasksWidget,
  tendersWidget,
  dipWidget
]

export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  return widgetRegistry.find((def) => def.type === type)
}

// Grid units and widget sizes must never hot-swap into a running desktop (the saved layout
// would be read with the wrong scale and overwritten). Reload the page from disk instead.
import.meta.hot?.accept(() => window.location.reload())
