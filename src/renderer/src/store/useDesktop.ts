import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopState, SavedDesktop, WidgetRect } from '../../../shared/types'
import { findFreeSpot, fitRect, GRID_VERSION, toDesktopState, type Size } from '../desktop/layout'
import { getWidgetDefinition } from '../widgets/registry'

// Used to place widgets before the board has been measured.
const FALLBACK_AREA: Size = { width: 1000, height: 600 }

function createDefaultDesktop(area: Size): DesktopState {
  const empty: DesktopState = { widgets: [], positions: {}, gridVersion: GRID_VERSION }
  return addWidgetTo(empty, 'clock', area)
}

// Rects as currently drawn on the board, for every visible widget.
function visibleRects(state: DesktopState, area: Size): WidgetRect[] {
  return state.widgets
    .filter((w) => !w.hidden && state.positions[w.id])
    .map((w) => fitRect(state.positions[w.id], area, getWidgetDefinition(w.type)))
}

function addWidgetTo(state: DesktopState, type: string, area: Size): DesktopState {
  const def = getWidgetDefinition(type)
  if (!def) return state
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
  const size = { width: def.defaultSize.w, height: def.defaultSize.h }
  return {
    ...state,
    widgets: [
      ...state.widgets,
      { id, type, config: structuredClone(def.defaultConfig), hidden: false }
    ],
    positions: { ...state.positions, [id]: findFreeSpot(size, visibleRects(state, area), area) }
  }
}

// Convert old files, drop widgets whose type no longer exists, and give any widget
// without a position a free spot.
function sanitize(saved: SavedDesktop, area: Size): DesktopState {
  const state = toDesktopState(saved)
  const widgets = state.widgets.filter((w) => getWidgetDefinition(w.type))
  const positions: Record<string, WidgetRect> = {}
  for (const w of widgets) {
    const rect = state.positions[w.id]
    if (rect) positions[w.id] = rect
  }
  let result: DesktopState = { ...state, widgets, positions }
  for (const w of widgets) {
    if (positions[w.id]) continue
    const def = getWidgetDefinition(w.type)!
    const spot = findFreeSpot(
      { width: def.defaultSize.w, height: def.defaultSize.h },
      visibleRects(result, area),
      area
    )
    result = { ...result, positions: { ...result.positions, [w.id]: spot } }
  }
  return result
}

export interface DesktopStore {
  desktop: DesktopState | null
  setBoardSize(size: Size): void
  addWidget(type: string): void
  removeWidget(id: string): void
  setHidden(id: string, hidden: boolean): void
  bringToFront(id: string): void
  updateConfig(id: string, patch: Record<string, unknown>): void
  moveWidget(id: string, x: number, y: number): void
  resizeWidget(id: string, rect: WidgetRect): void
}

export function useDesktop(): DesktopStore {
  const [desktop, setDesktop] = useState<DesktopState | null>(null)
  const loaded = useRef(false)
  const boardSize = useRef<Size>(FALLBACK_AREA)

  useEffect(() => {
    let cancelled = false
    window.api.desktop
      .load()
      .catch((err) => {
        console.error('Could not load desktop', err)
        return null
      })
      .then((saved) => {
        if (cancelled) return
        const area = boardSize.current
        setDesktop(saved ? sanitize(saved, area) : createDefaultDesktop(area))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Save every change right away (changes only happen on drop, resize or config edits).
  useEffect(() => {
    if (!desktop) return
    if (!loaded.current) {
      loaded.current = true
      return
    }
    window.api.desktop.save(desktop).catch((err) => console.error('Could not save desktop', err))
  }, [desktop])

  const update = useCallback((fn: (state: DesktopState) => DesktopState) => {
    setDesktop((prev) => (prev ? fn(prev) : prev))
  }, [])

  const setBoardSize = useCallback((size: Size) => {
    boardSize.current = size
  }, [])

  const addWidget = useCallback(
    (type: string) => update((s) => addWidgetTo(s, type, boardSize.current)),
    [update]
  )

  const removeWidget = useCallback(
    (id: string) =>
      update((s) => {
        const positions = { ...s.positions }
        delete positions[id]
        return { ...s, widgets: s.widgets.filter((w) => w.id !== id), positions }
      }),
    [update]
  )

  const bringToFront = useCallback(
    (id: string) =>
      update((s) => {
        const index = s.widgets.findIndex((w) => w.id === id)
        if (index === -1 || index === s.widgets.length - 1) return s
        const widgets = [...s.widgets]
        widgets.push(...widgets.splice(index, 1))
        return { ...s, widgets }
      }),
    [update]
  )

  const setHidden = useCallback(
    (id: string, hidden: boolean) =>
      update((s) => ({
        ...s,
        widgets: s.widgets.map((w) => (w.id === id ? { ...w, hidden } : w))
      })),
    [update]
  )

  const updateConfig = useCallback(
    (id: string, patch: Record<string, unknown>) =>
      update((s) => ({
        ...s,
        widgets: s.widgets.map((w) =>
          w.id === id ? { ...w, config: { ...(w.config as object), ...patch } } : w
        )
      })),
    [update]
  )

  // Moving keeps the saved size, so a widget shrunk by a small window grows back later.
  const moveWidget = useCallback(
    (id: string, x: number, y: number) =>
      update((s) =>
        s.positions[id]
          ? { ...s, positions: { ...s.positions, [id]: { ...s.positions[id], x, y } } }
          : s
      ),
    [update]
  )

  const resizeWidget = useCallback(
    (id: string, rect: WidgetRect) =>
      update((s) => ({ ...s, positions: { ...s.positions, [id]: rect } })),
    [update]
  )

  return {
    desktop,
    setBoardSize,
    addWidget,
    removeWidget,
    setHidden,
    bringToFront,
    updateConfig,
    moveWidget,
    resizeWidget
  }
}
