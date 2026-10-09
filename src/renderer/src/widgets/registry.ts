import type { AnyWidgetDefinition } from './types'
import { clockWidget } from './clock'

// Every available widget. Adding a widget = create its folder + add it here.
export const widgetRegistry: AnyWidgetDefinition[] = [clockWidget]

export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  return widgetRegistry.find((def) => def.type === type)
}
