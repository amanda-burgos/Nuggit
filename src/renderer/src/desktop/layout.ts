import type { DesktopState, SavedDesktop, WidgetRect } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

export interface Size {
  width: number
  height: number
}

// Bump when the saved layout format changes, so older files can be converted.
// v1-v3 were grid-based (react-grid-layout); v4 stores free pixel rects.
export const GRID_VERSION = 4

const SPOT_STEP = 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function sizeLimits(
  def: AnyWidgetDefinition | undefined,
  area: Size
): Size & { maxW: number; maxH: number } {
  return {
    width: Math.min(def?.minSize?.w ?? 80, area.width),
    height: Math.min(def?.minSize?.h ?? 60, area.height),
    maxW: Math.min(def?.maxSize?.w ?? Infinity, area.width),
    maxH: Math.min(def?.maxSize?.h ?? Infinity, area.height)
  }
}

// Where a widget is drawn: its saved rect, shrunk and pushed inside the board if needed.
// The saved rect is never changed here, so the widget returns once there is room again.
export function fitRect(rect: WidgetRect, area: Size, def?: AnyWidgetDefinition): WidgetRect {
  const limits = sizeLimits(def, area)
  const w = clamp(rect.w, limits.width, limits.maxW)
  const h = clamp(rect.h, limits.height, limits.maxH)
  return {
    x: clamp(rect.x, 0, area.width - w),
    y: clamp(rect.y, 0, area.height - h),
    w,
    h
  }
}

// Dragging: the widget keeps its size and stops at the board edges.
export function moveRect(start: WidgetRect, dx: number, dy: number, area: Size): WidgetRect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, area.width - start.w),
    y: clamp(start.y + dy, 0, area.height - start.h)
  }
}

// Resizing from the bottom-right corner: respects the widget's limits and the board edges.
export function resizeRect(
  start: WidgetRect,
  dx: number,
  dy: number,
  area: Size,
  def?: AnyWidgetDefinition
): WidgetRect {
  const limits = sizeLimits(def, area)
  const maxW = Math.min(limits.maxW, area.width - start.x)
  const maxH = Math.min(limits.maxH, area.height - start.y)
  return {
    ...start,
    w: clamp(start.w + dx, Math.min(limits.width, maxW), maxW),
    h: clamp(start.h + dy, Math.min(limits.height, maxH), maxH)
  }
}

function overlaps(a: WidgetRect, b: WidgetRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// First free spot (scanning rows top-left first); if the board is full, cascade from the corner.
export function findFreeSpot(size: Size, taken: WidgetRect[], area: Size): WidgetRect {
  const w = Math.min(size.width, area.width)
  const h = Math.min(size.height, area.height)
  for (let y = 0; y + h <= area.height; y += SPOT_STEP) {
    for (let x = 0; x + w <= area.width; x += SPOT_STEP) {
      const spot = { x, y, w, h }
      if (!taken.some((r) => overlaps(spot, r))) return spot
    }
  }
  const offset = (taken.length % 8) * SPOT_STEP
  return fitRect({ x: offset, y: offset, w, h }, area)
}

// --- Converting older saved files ---

type LegacyEntry = { i: string; x: number; y: number; w: number; h: number }

// v1 -> v2 -> v3 grid conversions (kept so very old files still load).
const GRID_MIGRATIONS: Record<number, (l: LegacyEntry) => LegacyEntry> = {
  // v1: 12 cols, 64px rows -> v2: 36 cols, 24px rows
  1: (l) => ({
    i: l.i,
    x: l.x * 3,
    w: l.w * 3,
    y: Math.round((l.y * 64) / 24),
    h: Math.round((l.h * 64 - 4) / 24)
  }),
  // v2 -> v3: 1440 cols (~1px each), 1px rows
  2: (l) => ({ i: l.i, x: l.x * 40, w: l.w * 40, y: l.y * 24, h: l.h * 24 })
}

export function toDesktopState(saved: SavedDesktop): DesktopState {
  if (saved.positions && (saved.gridVersion ?? 1) >= GRID_VERSION) {
    return {
      widgets: saved.widgets,
      positions: saved.positions,
      detached: saved.detached ?? {},
      gridVersion: GRID_VERSION
    }
  }
  // Older files: take the large-window layout and turn it into pixels.
  let version = saved.gridVersion ?? 1
  let entries = saved.layouts?.lg ?? []
  while (version < 3) {
    entries = entries.map(GRID_MIGRATIONS[version])
    version++
  }
  // v3 items were ~0.96px per column and had 6px of spacing on every side.
  const positions: Record<string, WidgetRect> = {}
  for (const l of entries) {
    positions[l.i] = {
      x: Math.round(l.x * 0.96),
      y: l.y,
      w: Math.max(Math.round(l.w * 0.96) - 12, 1),
      h: Math.max(l.h - 12, 1)
    }
  }
  return {
    widgets: saved.widgets,
    positions,
    detached: saved.detached ?? {},
    gridVersion: GRID_VERSION
  }
}

// Layout logic must never hot-swap into a running desktop (it could save positions computed
// with the old rules). Reload the page from disk instead.
import.meta.hot?.accept(() => window.location.reload())
