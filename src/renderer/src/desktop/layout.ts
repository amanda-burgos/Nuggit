import type { Breakpoint, DesktopState, LayoutEntry } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

export const BREAKPOINT_KEYS: Breakpoint[] = ['lg', 'md', 'sm']

// Container widths (px) where each breakpoint starts, and its column count.
export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 1100, md: 700, sm: 0 }
export const COLS: Record<Breakpoint, number> = { lg: 36, md: 24, sm: 12 }

// Fine grid: each row step is ROW_HEIGHT + MARGIN = 24px.
export const ROW_HEIGHT = 12
export const MARGIN = 12

// Bump when the grid changes, so saved layouts can be converted.
export const GRID_VERSION = 2

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

// Version 1 grid: 12/8/4 columns, 48px rows with 16px margins (64px per row).
// Converts to the finer grid keeping each widget at about the same place and size.
export function migrateLayouts(state: DesktopState): DesktopState {
  if ((state.gridVersion ?? 1) >= GRID_VERSION) return state
  const step = ROW_HEIGHT + MARGIN
  const layouts = { ...state.layouts }
  for (const bp of BREAKPOINT_KEYS) {
    layouts[bp] = state.layouts[bp].map((l) => ({
      i: l.i,
      x: l.x * 3,
      w: l.w * 3,
      y: Math.round((l.y * 64) / step),
      h: Math.round((l.h * 64 - 16 + MARGIN) / step)
    }))
  }
  return { ...state, layouts, gridVersion: GRID_VERSION }
}
