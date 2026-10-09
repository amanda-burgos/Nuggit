import type { Breakpoint, DesktopState, LayoutEntry } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

export const BREAKPOINT_KEYS: Breakpoint[] = ['lg', 'md', 'sm']

// Container widths (px) where each breakpoint starts, and its column count.
export const BREAKPOINTS: Record<Breakpoint, number> = { lg: 1100, md: 700, sm: 0 }
// The grid is so fine (about 1px per step) that moving and resizing feels free,
// while breakpoints still let widgets reflow when the window gets small.
export const COLS: Record<Breakpoint, number> = { lg: 1440, md: 960, sm: 480 }
export const ROW_HEIGHT = 1

// Space between widgets comes from CSS padding inside each grid item (see desktop.css).
export const WIDGET_GAP = 12

// Bump when the grid changes, so saved layouts can be converted.
export const GRID_VERSION = 3

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

type LayoutsByBreakpoint = DesktopState['layouts']

function mapLayouts(
  layouts: LayoutsByBreakpoint,
  fn: (l: LayoutEntry) => LayoutEntry
): LayoutsByBreakpoint {
  const next = { ...layouts }
  for (const bp of BREAKPOINT_KEYS) next[bp] = layouts[bp].map(fn)
  return next
}

// Each step converts saved layouts from one grid version to the next,
// keeping every widget at about the same place and size.
const MIGRATIONS: Record<number, (l: LayoutEntry) => LayoutEntry> = {
  // v1: 12/8/4 cols, 64px per row (48px + 16px margin) -> v2: 36/24/12 cols, 24px per row
  1: (l) => ({
    i: l.i,
    x: l.x * 3,
    w: l.w * 3,
    y: Math.round((l.y * 64) / 24),
    h: Math.round((l.h * 64 - 4) / 24)
  }),
  // v2 -> v3: 40 times more columns, 1px rows
  2: (l) => ({ i: l.i, x: l.x * 40, w: l.w * 40, y: l.y * 24, h: l.h * 24 })
}

export function migrateLayouts(state: DesktopState): DesktopState {
  let version = state.gridVersion ?? 1
  let layouts = state.layouts
  while (version < GRID_VERSION) {
    layouts = mapLayouts(layouts, MIGRATIONS[version])
    version++
  }
  return version === state.gridVersion ? state : { ...state, layouts, gridVersion: version }
}

// Grid units and widget sizes must never hot-swap into a running desktop (the saved layout
// would be read with the wrong scale and overwritten). Reload the page from disk instead.
import.meta.hot?.accept(() => window.location.reload())
