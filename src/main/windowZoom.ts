import type { BrowserWindow } from 'electron'

// "Ajustar todo al tamaño de la ventana" (Ajustes → Apariencia → Letra): the main window
// is zoomed like ⌘+ / ⌘−, so the sidebar, the widgets and the text all grow or shrink
// together with the window. 1100 px wide (the window's starting size) = 100 %.
// Electron's zoom here is per window: detached widgets and the menu bar windows stay at 100 %.
const BASE_WIDTH = 1100
const MIN = 0.75
const MAX = 1.3

let win: BrowserWindow | null = null
let auto = true

function apply(): void {
  if (!win || win.isDestroyed()) return
  const [width] = win.getContentSize()
  const factor = auto ? Math.round(Math.min(MAX, Math.max(MIN, width / BASE_WIDTH)) * 100) / 100 : 1
  if (Math.abs(win.webContents.getZoomFactor() - factor) > 0.005)
    win.webContents.setZoomFactor(factor)
}

export function trackWindowZoom(next: BrowserWindow): void {
  win = next
  next.on('resize', apply)
  next.webContents.on('did-finish-load', apply)
  apply()
}

export function setAutoZoom(on: boolean): void {
  auto = on
  apply()
}
