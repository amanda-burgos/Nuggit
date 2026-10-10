import { BrowserWindow, nativeTheme, screen, type Rectangle, type WebContents } from 'electron'
import type { DetachedWidget, SavedDesktop, WidgetRect } from '../shared/types'
import { createAppWindow } from './appWindow'
import { getDesktop, onDesktopChange, setDetached } from './desktop'

// Detached widgets: each one is a small frameless window on the computer's desktop.
// The windows always follow `desktop.detached`; change that and they open/close to match.

const BOUNDS_SAVE_DELAY = 400
const HEADER_HEIGHT = 32 // the part of the window you grab to move it
const MIN_VISIBLE = 48 // px of the header that must stay on some screen

const windows = new Map<string, BrowserWindow>()
const closingByApp = new WeakSet<BrowserWindow>()
const focusOnShow = new Set<string>()
const pendingBounds = new Map<string, WidgetRect>()
let boundsTimer: NodeJS.Timeout | null = null
let quitting = false
let hiddenForLockdown = false

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toRectangle(r: WidgetRect): Rectangle {
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) }
}

function toRect(r: Rectangle): WidgetRect {
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}

function sameRectangle(a: Rectangle, b: Rectangle): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// If a window's header is not on any screen (e.g. its monitor was unplugged),
// move it inside the nearest screen.
function ensureVisible(b: Rectangle): Rectangle {
  const headerVisible = screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x)
    const h = Math.min(b.y + HEADER_HEIGHT, a.y + a.height) - Math.max(b.y, a.y)
    return w >= Math.min(MIN_VISIBLE, b.width) && h > 0
  })
  if (headerVisible) return b
  const center = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
  const area = screen.getDisplayNearestPoint(center).workArea
  const width = Math.min(b.width, area.width)
  const height = Math.min(b.height, area.height)
  return {
    x: clamp(b.x, area.x, area.x + area.width - width),
    y: clamp(b.y, area.y, area.y + area.height - height),
    width,
    height
  }
}

// Shown behind the page while it loads or resizes; matches --color-surface.
function surfaceColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#1b2346' : '#ffffff'
}

function queueBounds(id: string, win: BrowserWindow): void {
  if (win.isDestroyed()) return
  pendingBounds.set(id, toRect(win.getBounds()))
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(flushBounds, BOUNDS_SAVE_DELAY)
}

function flushBounds(): void {
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = null
  const detached = getDesktop()?.detached ?? {}
  const changes: Record<string, DetachedWidget> = {}
  for (const [id, bounds] of pendingBounds) {
    if (detached[id]) changes[id] = { ...detached[id], bounds }
  }
  pendingBounds.clear()
  if (Object.keys(changes).length > 0) setDetached(changes)
}

function createWidgetWindow(id: string, entry: DetachedWidget): BrowserWindow {
  const saved = toRectangle(entry.bounds)
  const bounds = ensureVisible(saved)
  const win = createAppWindow(
    {
      ...bounds,
      title: 'Nuggit',
      frame: false,
      roundedCorners: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      backgroundColor: surfaceColor()
    },
    { widget: id }
  )
  if (entry.alwaysOnTop) win.setAlwaysOnTop(true, 'floating')

  win.once('ready-to-show', () => {
    if (hiddenForLockdown) return
    // Just detached: bring it forward. Restored at launch: don't steal focus.
    if (focusOnShow.delete(id)) win.show()
    else win.showInactive()
  })

  const track = (): void => queueBounds(id, win)
  win.on('move', track)
  win.on('resize', track)
  if (!sameRectangle(saved, bounds)) track()

  win.on('closed', () => {
    if (windows.get(id) === win) windows.delete(id)
    // Closed by the user (e.g. Cmd+W): send the widget back to the board.
    if (!quitting && !closingByApp.has(win)) setDetached({ [id]: null })
  })
  return win
}

// Open, close or update windows so they match the saved desktop.
function syncWindows(state: SavedDesktop): void {
  const detached = state.detached ?? {}
  for (const [id, win] of windows) {
    if (detached[id]) continue
    windows.delete(id)
    pendingBounds.delete(id)
    closingByApp.add(win)
    win.close()
  }
  for (const [id, entry] of Object.entries(detached)) {
    const win = windows.get(id)
    if (!win) windows.set(id, createWidgetWindow(id, entry))
    else if (win.isAlwaysOnTop() !== entry.alwaysOnTop) {
      win.setAlwaysOnTop(entry.alwaysOnTop, 'floating')
    }
  }
}

function recheckVisibility(): void {
  for (const win of windows.values()) {
    const bounds = win.getBounds()
    const fixed = ensureVisible(bounds)
    if (!sameRectangle(bounds, fixed)) win.setBounds(fixed)
  }
}

export function initWidgetWindows(): void {
  onDesktopChange(syncWindows)
  const state = getDesktop()
  if (state) syncWindows(state)

  // macOS rearranges windows itself when a monitor goes away; check after it settles.
  const recheckSoon = (): void => void setTimeout(recheckVisibility, 500)
  screen.on('display-removed', recheckSoon)
  screen.on('display-metrics-changed', recheckSoon)
  nativeTheme.on('updated', () => {
    for (const win of windows.values()) win.setBackgroundColor(surfaceColor())
  })
}

// `rect` is relative to the content area of the window that asked (the board).
export function detachWidget(id: string, rect: WidgetRect, from: WebContents): void {
  const owner = BrowserWindow.fromWebContents(from)
  const state = getDesktop()
  if (!owner || !state || state.detached?.[id]) return
  const content = owner.getContentBounds()
  const bounds = ensureVisible(
    toRectangle({ x: content.x + rect.x, y: content.y + rect.y, w: rect.w, h: rect.h })
  )
  focusOnShow.add(id)
  setDetached({ [id]: { bounds: toRect(bounds), alwaysOnTop: false } })
}

export function attachWidget(id: string): void {
  setDetached({ [id]: null })
}

export function setAlwaysOnTop(id: string, alwaysOnTop: boolean): void {
  const entry = getDesktop()?.detached?.[id]
  if (entry) setDetached({ [id]: { ...entry, alwaysOnTop } })
}

// Lockdown hides every detached widget, and shows them again when it ends.
export function setAllVisible(visible: boolean): void {
  hiddenForLockdown = !visible
  for (const win of windows.values()) {
    if (visible) win.showInactive()
    else win.hide()
  }
}

export function setSizeLimits(
  from: WebContents,
  min?: { w: number; h: number },
  max?: { w: number; h: number }
): void {
  const win = BrowserWindow.fromWebContents(from)
  if (!win || ![...windows.values()].includes(win)) return
  if (min) win.setMinimumSize(Math.round(min.w), Math.round(min.h))
  if (max) win.setMaximumSize(Math.round(max.w), Math.round(max.h))
}

// Save where every window is before quitting, and keep them detached for next launch.
export function prepareQuit(): void {
  quitting = true
  flushBounds()
}
