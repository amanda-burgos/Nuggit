import { BrowserWindow, nativeTheme, screen, type Rectangle, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import type {
  DetachedWidget,
  DetachedWindowOptions,
  SavedDesktop,
  WidgetRect
} from '../shared/types'
import { createAppWindow } from './appWindow'
import {
  addDetachedWidget,
  getDesktop,
  onDesktopChange,
  raiseOnBoard,
  setDetached,
  setWidgetHidden
} from './desktop'

// Detached widgets: each one is a small frameless window on the computer's desktop.
// The windows always follow `desktop.detached`; change that and they open/close to match.

const BOUNDS_SAVE_DELAY = 400
const HEADER_HEIGHT = 32 // the part of the window you grab to move it
const MIN_VISIBLE = 48 // px of the header that must stay on some screen

const windows = new Map<string, BrowserWindow>()
// Windows created at the desktop level ("Pin on back"). macOS fixes a window's type when it
// is created, so turning it on or off means opening the window again.
const backWindows = new WeakSet<BrowserWindow>()
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

// "Pin on top" (and on every desktop), and "Fijar": the window can't be moved or resized.
function applyWindowState(win: BrowserWindow, entry: DetachedWidget, locked: boolean): void {
  const onTop = entry.alwaysOnTop && !entry.pinBack
  if (win.isAlwaysOnTop() !== onTop) win.setAlwaysOnTop(onTop, 'floating')
  const allSpaces = onTop && (entry.allSpaces ?? false)
  if (win.isVisibleOnAllWorkspaces() !== allSpaces) {
    win.setVisibleOnAllWorkspaces(allSpaces, { visibleOnFullScreen: allSpaces })
  }
  if (win.isMovable() === locked) win.setMovable(!locked)
  if (win.isResizable() === locked) win.setResizable(!locked)
  const shadow = entry.shadow ?? false
  if (win.hasShadow() !== shadow) win.setHasShadow(shadow)
}

function isLocked(id: string): boolean {
  return getDesktop()?.widgets.find((w) => w.id === id)?.locked ?? false
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
      hasShadow: entry.shadow ?? false,
      backgroundColor: surfaceColor(),
      // "Pin on back": the desktop picture's level, behind its files and icons.
      ...(entry.pinBack ? { type: 'desktop' } : {})
    },
    { widget: id }
  )
  if (entry.pinBack) backWindows.add(win)
  applyWindowState(win, entry, isLocked(id))

  win.once('ready-to-show', () => {
    // Set again now: macOS ignores "can't move / resize" set before a window first shows.
    const current = getDesktop()?.detached?.[id]
    if (current) applyWindowState(win, current, isLocked(id))
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
    if (win && backWindows.has(win) !== Boolean(entry.pinBack)) {
      // "Pin on back" changed: open the window again with the other type.
      closingByApp.add(win)
      win.close()
      windows.set(id, createWidgetWindow(id, entry))
      continue
    }
    if (!win) {
      windows.set(id, createWidgetWindow(id, entry))
      continue
    }
    applyWindowState(win, entry, state.widgets.find((w) => w.id === id)?.locked ?? false)
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

// A free-looking spot near the middle of the screen with the mouse, a little lower and to
// the right for each widget already there, so new ones don't land on top of each other.
function spotOnScreen(size: { w: number; h: number }): WidgetRect {
  const { workArea: a } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const w = Math.min(size.w, a.width)
  const h = Math.min(size.h, a.height)
  const offset = (windows.size % 6) * 28
  return {
    x: Math.round(clamp(a.x + (a.width - w) / 2 + offset, a.x, a.x + a.width - w)),
    y: Math.round(clamp(a.y + (a.height - h) / 3 + offset, a.y, a.y + a.height - h)),
    w,
    h
  }
}

// "Pin on top" and "Pin on back" are never on together: turning one on turns the other off.
// Turning either on for a widget still on the board takes it out to the desktop first.
export function setWindowOptions(id: string, input: DetachedWindowOptions): void {
  const options = { ...input }
  if (options.alwaysOnTop) options.pinBack = false
  if (options.pinBack) options.alwaysOnTop = false
  const state = getDesktop()
  const entry = state?.detached?.[id]
  if (entry) {
    setDetached({ [id]: { ...entry, ...options } })
    return
  }
  if (!(options.alwaysOnTop || options.pinBack) || !state?.widgets.some((w) => w.id === id)) return
  const size = state.positions?.[id] ?? { w: 360, h: 320 }
  focusOnShow.add(id)
  setWidgetHidden(id, false)
  setDetached({ [id]: { bounds: spotOnScreen(size), alwaysOnTop: false, ...options } })
}

const WIDGET_TYPE = /^[a-z][a-z0-9-]{0,40}$/

// Quick pickup: a new widget, straight onto the computer's desktop.
export function openWidget(input: unknown): void {
  if (typeof input !== 'object' || input === null) return
  const { type, config, size } = input as Record<string, unknown>
  if (typeof type !== 'string' || !WIDGET_TYPE.test(type)) return
  const s = (typeof size === 'object' && size !== null ? size : {}) as Record<string, unknown>
  const w = clamp(Number(s.w) || 360, 120, 2000)
  const h = clamp(Number(s.h) || 320, 100, 2000)
  const id = `${type}-${randomUUID().slice(0, 8)}`
  focusOnShow.add(id)
  addDetachedWidget(
    {
      id,
      type,
      config: typeof config === 'object' && config !== null ? config : {},
      hidden: false
    },
    { bounds: spotOnScreen({ w, h }), alwaysOnTop: false }
  )
}

// Quick pickup: a detached widget's window comes to the front; one on the board is shown
// on top of the others, and the board is opened (showBoard).
export function focusWidget(id: string, showBoard: () => void): void {
  const win = windows.get(id)
  if (win) {
    win.show()
    win.focus()
    return
  }
  raiseOnBoard(id)
  showBoard()
}

// Quick pickup: "Cerrar". A detached widget goes back to the board; one on the board is
// hidden (it can be shown again from "+ Widget" or the quick pickup).
export function closeWidget(id: string): void {
  if (getDesktop()?.detached?.[id]) setDetached({ [id]: null })
  else setWidgetHidden(id, true)
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
