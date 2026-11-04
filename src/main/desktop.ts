import { BrowserWindow, type WebContents } from 'electron'
import type { Background, DetachedWidget, SavedDesktop, WidgetInstance } from '../shared/types'
import { isSavedDesktop, loadDesktop, saveDesktop } from './storage'

// The main process holds the one true copy of the desktop, because several windows
// (the board and every detached widget) read and change it. Every change is saved
// and sent to the other windows.
let state: SavedDesktop | null = null
const listeners = new Set<(state: SavedDesktop) => void>()

export async function initDesktop(): Promise<void> {
  state = await loadDesktop()
}

export function getDesktop(): SavedDesktop | null {
  return state
}

export function onDesktopChange(listener: (state: SavedDesktop) => void): void {
  listeners.add(listener)
}

function commit(next: SavedDesktop, except?: WebContents): void {
  state = next
  saveDesktop(next).catch((err) => console.error('[desktop] could not save', err))
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents !== except) win.webContents.send('desktop:changed', next)
  }
  listeners.forEach((listener) => listener(next))
}

// The board window sends its whole state. Which widgets are detached (and where) is
// decided here only, so a board save never undoes a detach or a window move.
export function replaceDesktop(next: unknown, sender: WebContents): void {
  if (!isSavedDesktop(next) || !next.positions) throw new Error('Invalid desktop state')
  const ids = new Set(next.widgets.map((w) => w.id))
  const detached = Object.fromEntries(
    Object.entries(state?.detached ?? {}).filter(([id]) => ids.has(id))
  )
  commit({ ...next, detached }, sender)
}

export function updateWidgetConfig(id: string, patch: Record<string, unknown>): void {
  if (!state) return
  commit({
    ...state,
    widgets: state.widgets.map((w) =>
      w.id === id ? { ...w, config: { ...(w.config as object), ...patch } } : w
    )
  })
}

// Set (or with null, remove) the detached entry of one or more widgets.
export function setDetached(changes: Record<string, DetachedWidget | null>): void {
  if (!state) return
  const detached = { ...state.detached }
  for (const [id, entry] of Object.entries(changes)) {
    if (entry && state.widgets.some((w) => w.id === id)) detached[id] = entry
    else delete detached[id]
  }
  commit({ ...state, detached })
}

function updateWidget(id: string, patch: Partial<WidgetInstance>): void {
  if (!state || !state.widgets.some((w) => w.id === id)) return
  commit({ ...state, widgets: state.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
}

// "Fijar" (SPEC 9.16): the widget can't be moved or resized, wherever it is.
export function setWidgetLocked(id: string, locked: boolean): void {
  updateWidget(id, { locked })
}

// Fase 9: a widget's own background (null = use the general one).
export function setWidgetBackground(id: string, background: Background | null): void {
  if (!state || !state.widgets.some((w) => w.id === id)) return
  commit({
    ...state,
    widgets: state.widgets.map((w) => {
      if (w.id !== id) return w
      const next = { ...w }
      delete next.background
      return background ? { ...next, background } : next
    })
  })
}

// A widget's own corner roundness in px (null = use the general one).
export function setWidgetRadius(id: string, radius: number | null): void {
  if (!state || !state.widgets.some((w) => w.id === id)) return
  commit({
    ...state,
    widgets: state.widgets.map((w) => {
      if (w.id !== id) return w
      const next = { ...w }
      delete next.radius
      return radius === null ? next : { ...next, radius }
    })
  })
}

// Fase 13: a widget's own font (null = use the general one).
export function setWidgetFont(id: string, font: string | null): void {
  if (!state || !state.widgets.some((w) => w.id === id)) return
  commit({
    ...state,
    widgets: state.widgets.map((w) => {
      if (w.id !== id) return w
      const next = { ...w }
      delete next.font
      return font === null ? next : { ...next, font }
    })
  })
}

// A widget's own text size (null = normal).
export function setWidgetTextScale(id: string, scale: number | null): void {
  if (!state || !state.widgets.some((w) => w.id === id)) return
  commit({
    ...state,
    widgets: state.widgets.map((w) => {
      if (w.id !== id) return w
      const next = { ...w }
      delete next.textScale
      return scale === null || scale === 1 ? next : { ...next, textScale: scale }
    })
  })
}

export function setWidgetHidden(id: string, hidden: boolean): void {
  updateWidget(id, { hidden })
}

// Moves a widget to the top of the board's stack (and shows it if it was hidden).
export function raiseOnBoard(id: string): void {
  const widget = state?.widgets.find((w) => w.id === id)
  if (!state || !widget) return
  commit({
    ...state,
    widgets: [...state.widgets.filter((w) => w !== widget), { ...widget, hidden: false }]
  })
}

// A new widget that lives on the computer's desktop from the start. The board gives it a
// spot of its own the next time it loads (for when it is sent back with "Regresar").
export function addDetachedWidget(widget: WidgetInstance, entry: DetachedWidget): void {
  if (!state) state = { widgets: [], positions: {}, detached: {}, gridVersion: 4 }
  commit({
    ...state,
    widgets: [...state.widgets, widget],
    detached: { ...state.detached, [widget.id]: entry }
  })
}
