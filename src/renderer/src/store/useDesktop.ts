import { useCallback, useEffect, useRef, useState } from 'react'
import type { Breakpoint, DesktopState, LayoutEntry } from '../../../shared/types'
import {
  BREAKPOINT_KEYS,
  GRID_VERSION,
  migrateLayouts,
  placeNewWidget,
  toLayoutEntry
} from '../desktop/layout'
import { getWidgetDefinition } from '../widgets/registry'

function createDefaultDesktop(): DesktopState {
  const empty: DesktopState = {
    widgets: [],
    layouts: { lg: [], md: [], sm: [] },
    gridVersion: GRID_VERSION
  }
  return addWidgetTo(empty, 'clock')
}

function addWidgetTo(state: DesktopState, type: string): DesktopState {
  const def = getWidgetDefinition(type)
  if (!def) return state
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
  return {
    ...state,
    widgets: [
      ...state.widgets,
      { id, type, config: structuredClone(def.defaultConfig), hidden: false }
    ],
    layouts: placeNewWidget(state.layouts, id, def)
  }
}

// Convert old grids, drop widgets whose type no longer exists and orphan layout entries.
function sanitize(saved: DesktopState): DesktopState {
  const state = migrateLayouts(saved)
  const widgets = state.widgets.filter((w) => getWidgetDefinition(w.type))
  const ids = new Set(widgets.map((w) => w.id))
  const layouts = { ...state.layouts }
  for (const bp of BREAKPOINT_KEYS) layouts[bp] = layouts[bp].filter((l) => ids.has(l.i))
  return { ...state, widgets, layouts }
}

export interface DesktopStore {
  desktop: DesktopState | null
  addWidget(type: string): void
  removeWidget(id: string): void
  setHidden(id: string, hidden: boolean): void
  bringToFront(id: string): void
  updateConfig(id: string, patch: Record<string, unknown>): void
  applyLayouts(layouts: Partial<Record<Breakpoint, readonly LayoutEntry[]>>): void
}

export function useDesktop(): DesktopStore {
  const [desktop, setDesktop] = useState<DesktopState | null>(null)
  const loaded = useRef(false)

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
        setDesktop(saved ? sanitize(saved) : createDefaultDesktop())
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

  const addWidget = useCallback((type: string) => update((s) => addWidgetTo(s, type)), [update])

  const removeWidget = useCallback(
    (id: string) =>
      update((s) => {
        const layouts = { ...s.layouts }
        for (const bp of BREAKPOINT_KEYS) layouts[bp] = layouts[bp].filter((l) => l.i !== id)
        return { ...s, widgets: s.widgets.filter((w) => w.id !== id), layouts }
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

  // The grid only knows visible widgets, so keep hidden widgets' positions as they were.
  const applyLayouts = useCallback(
    (incoming: Partial<Record<Breakpoint, readonly LayoutEntry[]>>) =>
      update((s) => {
        const hiddenIds = new Set(s.widgets.filter((w) => w.hidden).map((w) => w.id))
        const knownIds = new Set(s.widgets.map((w) => w.id))
        const layouts = { ...s.layouts }
        for (const bp of BREAKPOINT_KEYS) {
          const items = incoming[bp]
          if (!items) continue
          const visible = items.filter((l) => knownIds.has(l.i) && !hiddenIds.has(l.i))
          const kept = s.layouts[bp].filter((l) => hiddenIds.has(l.i))
          layouts[bp] = [...visible.map(toLayoutEntry), ...kept]
        }
        return JSON.stringify(layouts) === JSON.stringify(s.layouts) ? s : { ...s, layouts }
      }),
    [update]
  )

  return {
    desktop,
    addWidget,
    removeWidget,
    setHidden,
    bringToFront,
    updateConfig,
    applyLayouts
  }
}
