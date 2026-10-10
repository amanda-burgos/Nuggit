import { BrowserWindow, type WebContents } from 'electron'
import type { DetachedWidget, SavedDesktop } from '../shared/types'
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
