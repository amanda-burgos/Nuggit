import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// Every Nuggit window: same secure settings, same renderer, links open in the browser.
// `query` tells the renderer what to show (e.g. { widget: id } for a detached widget).
export function createAppWindow(
  options: BrowserWindowConstructorOptions,
  query: Record<string, string> = {}
): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    ...options,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Open external links in the default browser, never inside the app
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
  return win
}
