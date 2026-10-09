import type { Breakpoint, DesktopState, LayoutEntry } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

export const BREAKPOINT_KEYS: Breakpoint[] = ['lg', 'md', 'sm']

// Container widths (px) where each breakpoint starts, and its column count.
export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 1100, md: 700, sm: 0 }
export const COLS: Record<Breakpoint, number> = { lg: 12, md: 8, sm: 4 }

export const ROW_HEIGHT = 48

export function bottomOf(layout: LayoutEntry[]): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
}

// Place a new widget at the bottom-left of every breakpoint's layout.
export function placeNewWidget(
  layouts: DesktopState['layouts'],
  id: string,
  def: AnyWidgetDefinition
): DesktopState['layouts'] {
  const next = { ...layouts }
  for (const bp of BREAKPOINT_KEYS) {
    const cols = COLS[bp]
    next[bp] = [
      ...layouts[bp],
      {
        i: id,
        x: 0,
        y: bottomOf(layouts[bp]),
        w: Math.min(def.defaultSize.w, cols),
        h: def.defaultSize.h
      }
    ]
  }
  return next
}

export function toLayoutEntry(item: LayoutEntry): LayoutEntry {
  return { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }
}
