import { app, BrowserWindow, globalShortcut, nativeImage, screen, Tray } from 'electron'
import type { DipShortcut, Settings } from '../shared/types'
import { createAppWindow } from './appWindow'

// SPEC 9.15: Dip's own menu bar icon (apart from Nuggit's, 9.11). Clicking it opens a small
// floating window under the icon with a mini chat, the same conversation as the Dip tab.
// It closes on a click outside, with its X or with Esc. An optional global shortcut opens it
// from any app.

const POPOVER = { width: 360, height: 500 }

let tray: Tray | null = null
let popover: BrowserWindow | null = null
let shortcut: DipShortcut = ''
let shortcutOk = true

// A one-colour silhouette drawn in code: a little bowl of dip with a drop above it.
// Marked as a template image, so macOS paints it right in light and dark menu bars.
let icon: Electron.NativeImage | null = null
function dipIcon(): Electron.NativeImage {
  if (icon) return icon
  const size = 18 // points
  const scale = 2
  const px = size * scale
  const inShape = (x: number, y: number): boolean => {
    // Bowl: the lower half of a circle, under a rounded rim.
    const bowl = y >= 17 && Math.hypot(x - 18, y - 17) <= 14
    const rim = y >= 14.5 && y <= 18 && x >= 3 && x <= 33
    // Drop: a circle with a point on top.
    const dropCircle = Math.hypot(x - 18, y - 9) <= 4
    const dropTip = y >= 2 && y <= 9 && Math.abs(x - 18) <= ((y - 2) / 7) * 3.6
    return bowl || rim || dropCircle || dropTip
  }
  const bitmap = Buffer.alloc(px * px * 4)
  const samples = 4 // per axis, for smooth edges
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (inShape(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)) hits++
        }
      }
      // Black with coverage as alpha (BGRA, premultiplied: black stays 0).
      bitmap[(y * px + x) * 4 + 3] = Math.round((255 * hits) / (samples * samples))
    }
  }
  icon = nativeImage.createFromBitmap(bitmap, { width: px, height: px, scaleFactor: scale })
  icon.setTemplateImage(true)
  return icon
}

function createPopover(): BrowserWindow {
  const win = createAppWindow(
    {
      ...POPOVER,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      // A non-activating panel: it opens over any app (even full screen) without bringing
      // Nuggit's other windows to the front.
      type: 'panel',
      title: 'Dip'
    },
    { view: 'popover' }
  )
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.on('blur', () => win.hide())
  win.on('closed', () => {
    if (popover === win) popover = null
  })
  return win
}

// Under the menu bar icon, or at the top center of the screen with the mouse.
function place(win: BrowserWindow): void {
  const anchor = tray?.getBounds()
  const point =
    anchor && anchor.width ? { x: anchor.x, y: anchor.y } : screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(point)
  const x =
    anchor && anchor.width
      ? anchor.x + anchor.width / 2 - POPOVER.width / 2
      : workArea.x + workArea.width / 2 - POPOVER.width / 2
  win.setPosition(
    Math.round(
      Math.min(Math.max(x, workArea.x + 8), workArea.x + workArea.width - POPOVER.width - 8)
    ),
    Math.round(workArea.y + 6)
  )
}

export function showPopover(): void {
  if (!popover) popover = createPopover()
  const win = popover
  place(win)
  const show = (): void => {
    win.show()
    win.focus()
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', show)
  else show()
}

export function hidePopover(): void {
  popover?.hide()
}

function togglePopover(): void {
  if (popover?.isVisible()) hidePopover()
  else showPopover()
}

function setTrayVisible(visible: boolean): void {
  if (visible && !tray) {
    tray = new Tray(dipIcon())
    tray.setToolTip('Dip')
    tray.on('click', togglePopover)
    tray.on('right-click', togglePopover)
  } else if (!visible && tray) {
    tray.destroy()
    tray = null
  }
}

function setShortcut(next: DipShortcut): void {
  if (next === shortcut) return
  if (shortcut) globalShortcut.unregister(shortcut)
  shortcut = next
  shortcutOk = next ? globalShortcut.register(next, togglePopover) : true
  if (!shortcutOk) console.warn(`[dip-tray] the shortcut ${next} is taken by another app`)
}

export function setDipTrayOptions(options: Settings['dipTray']): void {
  setTrayVisible(options.visible)
  setShortcut(options.shortcut)
}

export function dipShortcutWorks(): boolean {
  return shortcutOk
}

export function initDipTray(options: Settings['dipTray']): void {
  setDipTrayOptions(options)
  app.on('will-quit', () => globalShortcut.unregisterAll())
  // Load it ahead of time so it opens instantly the first time.
  popover = createPopover()
}
