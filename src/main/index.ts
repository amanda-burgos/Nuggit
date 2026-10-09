import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { flushWrites } from './storage/jsonStore'
import icon from '../../resources/icon.png?asset'

// Optional separate data folder (handy for testing without touching your real data)
if (process.env['NUGGIT_USER_DATA']) {
  app.setPath('userData', process.env['NUGGIT_USER_DATA'])
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 400,
    show: false,
    title: 'Nuggit',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in the default browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nuggit.app')

  // F12 toggles DevTools in dev; Cmd/Ctrl+R reload is disabled in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Finish any pending saves before quitting, so the last change is never lost.
let writesFlushed = false
app.on('before-quit', (event) => {
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
