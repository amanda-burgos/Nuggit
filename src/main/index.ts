import { app, nativeTheme, type BrowserWindow } from 'electron'
import type { Settings, StatusIndicator } from '../shared/types'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initAI } from './ai'
import { initDipChat } from './dipChat'
import { initDipTray } from './dipTray'
import { createAppWindow } from './appWindow'
import { initDesktop } from './desktop'
import { initNextAction } from './nextAction'
import { registerIpc } from './ipc'
import { changeSettings } from './settings'
import { initStatusTray } from './statusTray'
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

function createWindow(): BrowserWindow {
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
  return win
}

// Brings the board window to the front (creating it if it was closed).
function showMainWindow(): BrowserWindow {
  if (!mainWindow) return createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  return mainWindow
}

function openSettings(): void {
  const win = showMainWindow()
  const send = (): void => win.webContents.send('app:openSettings')
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.nuggit.app')

  // F12 toggles DevTools in dev; Cmd/Ctrl+R reload is disabled in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  let statusIndicator: StatusIndicator = 'dot'
  let dipTray: Settings['dipTray'] = { visible: true, shortcut: '' }
  try {
    const settings = await loadSettings()
    nativeTheme.themeSource = settings.theme
    statusIndicator = settings.statusIndicator
    dipTray = settings.dipTray
    await initDesktop()
  } catch (err) {
    console.error('[startup] could not load saved data', err)
  }
  try {
    await initTasks()
  } catch (err) {
    console.error('[startup] could not load tasks', err)
  }
  try {
    await initNextAction()
  } catch (err) {
    console.error('[startup] could not load Next Action', err)
  }
  try {
    await initDipChat()
  } catch (err) {
    console.error('[startup] could not load the Dip chat', err)
  }
  try {
    await initAI()
  } catch (err) {
    console.error('[startup] could not check the AI key', err)
  }

  registerIpc({ openSettings })
  createWindow()
  initWidgetWindows()
  initStatusTray({
    mode: statusIndicator,
    openApp: () => {
      showMainWindow()
    },
    chooseMode: (mode) => {
      changeSettings({ statusIndicator: mode }).catch((err) =>
        console.error('[settings] could not save', err)
      )
    }
  })

  initDipTray(dipTray)

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
