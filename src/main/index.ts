import { app, nativeTheme, type BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './appWindow'
import { initDesktop } from './desktop'
import { registerIpc } from './ipc'
import { initTasks } from './tasks'
import { loadSettings } from './storage'
import { flushWrites } from './storage/jsonStore'
import { initWidgetWindows, prepareQuit } from './widgetWindows'
import icon from '../../resources/icon.png?asset'

// Optional separate data folder (handy for testing without touching your real data)
if (process.env['NUGGIT_USER_DATA']) {
  app.setPath('userData', process.env['NUGGIT_USER_DATA'])
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = createAppWindow({
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 400,
    title: 'Nuggit',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {})
  })
  mainWindow = win

  win.on('ready-to-show', () => {
    win.show()
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.nuggit.app')

  // F12 toggles DevTools in dev; Cmd/Ctrl+R reload is disabled in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const settings = await loadSettings()
    nativeTheme.themeSource = settings.theme
    await initDesktop()
  } catch (err) {
    console.error('[startup] could not load saved data', err)
  }
  try {
    await initTasks()
  } catch (err) {
    console.error('[startup] could not load tasks', err)
  }

  registerIpc()
  createWindow()
  initWidgetWindows()

  // Clicking the Dock icon brings the board back, even if detached widgets are open.
  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
})

// Finish any pending saves before quitting, so the last change is never lost.
let writesFlushed = false
app.on('before-quit', (event) => {
  prepareQuit()
  if (writesFlushed) return
  event.preventDefault()
  flushWrites().finally(() => {
    writesFlushed = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
