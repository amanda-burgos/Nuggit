import { app, BrowserWindow, screen, type Rectangle, type WebContents } from 'electron'
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
// "Pin on back" widgets get no clicks. "Editar" (quick pickup) brings one up as a normal
// window for a moment; it goes back to the bottom when done. Not saved: only while editing.
const editingBack = new Set<string>()

function isBack(id: string, entry: DetachedWidget): boolean {
  return Boolean(entry.pinBack) && !editingBack.has(id)
}
const closingByApp = new WeakSet<BrowserWindow>()
const focusOnShow = new Set<string>()
const pendingBounds = new Map<string, WidgetRect>()
let boundsTimer: NodeJS.Timeout | null = null
let quitting = false

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

// Widget windows are transparent and the page draws the rounded card itself. An opaque
// frameless window gets a thin light edge from macOS that stays even without a shadow;
// a transparent one doesn't. With "Sombra", macOS draws the shadow around the card's shape.
function refreshShadow(win: BrowserWindow): void {
  if (!win.isDestroyed() && win.hasShadow()) win.invalidateShadow()
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

// "Pin on top" (on every desktop and over full screen apps unless turned off), and "Fijar":
// the window can't be moved or resized. force: set everything again even if it looks set
// (macOS may not keep what was set before the window first showed).
function applyWindowState(
  win: BrowserWindow,
  entry: DetachedWidget,
  locked: boolean,
  force = false,
  editing = false // "Editar" on a "Pin on back" widget: in front of everything meanwhile
): void {
  const onTop = editing || (entry.alwaysOnTop && !entry.pinBack)
  if (force || win.isAlwaysOnTop() !== onTop) win.setAlwaysOnTop(onTop, 'floating')
  const allSpaces = onTop && !editing && (entry.allSpaces ?? true)
  if (force || win.isVisibleOnAllWorkspaces() !== allSpaces) {
    win.setVisibleOnAllWorkspaces(allSpaces, { visibleOnFullScreen: allSpaces })
  }
  if (win.isMovable() === locked) win.setMovable(!locked)
  if (win.isResizable() === locked) win.setResizable(!locked)
  const shadow = entry.shadow ?? false
  if (win.hasShadow() !== shadow) {
    win.setHasShadow(shadow)
    refreshShadow(win)
  }
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
      transparent: true,
      roundedCorners: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: entry.shadow ?? false,
      backgroundColor: '#00000000',
      // "Pin on back": the desktop picture's level, behind its files and icons.
      ...(isBack(id, entry) ? { type: 'desktop' } : {})
    },
    { widget: id, ...(editingBack.has(id) ? { editBack: '1' } : {}) }
  )
  if (isBack(id, entry)) backWindows.add(win)
  // Editing a "Pin on back" widget: once it has held focus for a moment, clicking anywhere
  // else sends it back to the bottom. In that first moment, macOS (making Nuggit the active
  // app) may hand focus to another Nuggit window: the widget takes it back.
  if (editingBack.has(id)) {
    let settled = false
    win.on('focus', () => {
      if (settled) return
      setTimeout(() => {
        if (!win.isDestroyed() && win.isFocused()) settled = true
      }, 800)
    })
    win.on('blur', () =>
      setTimeout(() => {
        if (win.isDestroyed() || win.isFocused()) return
        if (settled) finishEditingBack(id)
        else win.focus()
      }, 400)
    )
  }
  applyWindowState(win, entry, isLocked(id), false, editingBack.has(id))

  win.once('ready-to-show', () => {
    // Set again now: macOS ignores "can't move / resize" set before a window first shows.
    const current = getDesktop()?.detached?.[id]
    if (current) applyWindowState(win, current, isLocked(id), true, editingBack.has(id))
    // The shadow follows what is drawn, so work it out again once the card is there.
    setTimeout(() => refreshShadow(win), 300)
    // Just detached (or "Editar"): bring it forward. Restored at launch: don't steal focus.
    if (focusOnShow.delete(id)) {
      // Asked for from the quick pickup, a panel that doesn't make Nuggit the active app.
      if (editingBack.has(id)) app.focus({ steal: true })
      win.show()
      win.focus()
    } else win.showInactive()
  })

  const track = (): void => queueBounds(id, win)
  win.on('move', track)
  win.on('resize', track)
  win.on('resized', () => refreshShadow(win))
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
    if (!entry.pinBack) editingBack.delete(id)
    const win = windows.get(id)
    if (win && backWindows.has(win) !== isBack(id, entry)) {
      // "Pin on back" (or editing one) changed: open the window again with the other type.
      closingByApp.add(win)
      win.close()
      windows.set(id, createWidgetWindow(id, entry))
      continue
    }
    if (!win) {
      windows.set(id, createWidgetWindow(id, entry))
      continue
    }
    applyWindowState(
      win,
      entry,
      state.widgets.find((w) => w.id === id)?.locked ?? false,
      false,
      editingBack.has(id)
    )
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
}

// `rect` is relative to the content area of the window that asked (the board).
export function detachWidget(id: string, rect: WidgetRect, from: WebContents): void {
  const owner = BrowserWindow.fromWebContents(from)
  const state = getDesktop()
  if (!owner || !state || state.detached?.[id]) return
  const content = owner.getContentBounds()
  // The board may be zoomed (windowZoom.ts): its page pixels are bigger or smaller than the
  // screen's. The widget keeps its size in page pixels, since its own window isn't zoomed.
  const zoom = from.getZoomFactor()
  const bounds = ensureVisible(
    toRectangle({
      x: content.x + Math.round(rect.x * zoom),
      y: content.y + Math.round(rect.y * zoom),
      w: rect.w,
      h: rect.h
    })
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

// Quick pickup, "Editar" on a "Pin on back" widget: up to the front to move or change it.
export function startEditingBack(id: string): void {
  const state = getDesktop()
  if (!state?.detached?.[id]?.pinBack || editingBack.has(id)) return
  editingBack.add(id)
  focusOnShow.add(id)
  syncWindows(state)
}

// "Listo", or a click somewhere else: back to the bottom.
export function finishEditingBack(id: string): void {
  const state = getDesktop()
  if (!editingBack.delete(id) || !state) return
  syncWindows(state)
}

// "Pin on top" and "Pin on back" are never on together: turning one on turns the other off.
// "Pin on top" is on every desktop unless the user turned that off.
// Turning either on for a widget still on the board takes it out to the desktop first.
export function setWindowOptions(id: string, input: DetachedWindowOptions): void {
  const options = { ...input }
  if (options.alwaysOnTop) {
    options.pinBack = false
    if (options.allSpaces === undefined) options.allSpaces = true
  }
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
  // A "Pin on back" widget can't take clicks where it is: bring it up to edit it.
  if (getDesktop()?.detached?.[id]?.pinBack) return startEditingBack(id)
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
