import { app, nativeTheme, type BrowserWindow } from 'electron'
import type { Settings, StatusIndicator } from '../shared/types'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initAI, setEnvFile } from './ai'
import { loadDotEnv } from './ai/config'
import { initDipChat } from './dipChat'
import { initDipTray } from './dipTray'
import { createAppWindow } from './appWindow'
import { initDailies } from './dailies'
import { initNotes } from './notes'
import { initQotd } from './qotd'
import { initReminders } from './reminders'
import { initUpdates } from './updates'
import { initDesktop } from './desktop'
import { initFocus } from './focus'
import { initCalendar } from './calendar'
import { initNextAction } from './nextAction'
import { cleanUpImages, registerImageScheme, serveImages } from './images'
import { initMusicTray } from './musicTray'
import { initPickupTray } from './pickupTray'
import { registerIpc } from './ipc'
import { changeSettings, musicTrayMode } from './settings'
import { initStatusTray } from './statusTray'
import { initTasks } from './tasks'
import { loadSettings } from './storage'
import { setLang } from '../shared/i18n'
import { flushWrites } from './storage/jsonStore'
import { initWidgetWindows, prepareQuit } from './widgetWindows'
import icon from '../../resources/icon.png?asset'

// SPEC 8.1: AI settings from a .env file (the project folder in development, or the data
// folder). Real environment variables win over it.
setEnvFile(loadDotEnv([app.getAppPath(), process.cwd(), app.getPath('userData')]))

// Pictures copied into the data folder are shown through nuggit-img:// (Fase 9).
registerImageScheme()

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

// The main window, on that tab. The tab is checked by the settings (an unknown one is ignored).
function openTab(tab: unknown): void {
  showMainWindow()
  changeSettings({ ui: { tab } }).catch((err) => console.error('[settings] could not save', err))
}

app.whenReady().then(async () => {
  serveImages()
  electronApp.setAppUserModelId('com.nuggit.app')
  // While developing, the Dock would show Electron's icon: show Nuggit's.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(icon)

  // F12 toggles DevTools in dev; Cmd/Ctrl+R reload is disabled in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  let statusIndicator: StatusIndicator = 'dot'
  let dipTray: Settings['dipTray'] = { visible: true, shortcut: '' }
  let pickupTray: Settings['pickupTray'] = 'icon'
  let musicTray: NonNullable<Settings['musicTray']> = 'off'
  try {
    const settings = await loadSettings()
    setLang(settings.language)
    nativeTheme.themeSource = settings.theme
    statusIndicator = settings.statusIndicator
    dipTray = settings.dipTray
    pickupTray = settings.pickupTray
    musicTray = musicTrayMode(settings)
    await initDesktop()
    // Only once the desktop is loaded: it says which pictures are still in use.
    cleanUpImages().catch((err) => console.error('[images] clean up', err))
  } catch (err) {
    console.error('[startup] could not load saved data', err)
  }
  try {
    await initTasks()
  } catch (err) {
    console.error('[startup] could not load tasks', err)
  }
  try {
    // After the tasks: it makes today's task for each due daily.
    await initDailies()
  } catch (err) {
    console.error('[startup] could not load dailies', err)
  }
  try {
    await initNotes()
  } catch (err) {
    console.error('[startup] could not load notes', err)
  }
  try {
    await initQotd()
  } catch (err) {
    console.error('[startup] could not load the questions of the day', err)
  }
  try {
    // Rings them even with no window open (clicking the notice opens Recordatorios).
    await initReminders({ openTab })
  } catch (err) {
    console.error('[startup] could not load reminders', err)
  }
  initUpdates() // Fase 15: "nueva versión disponible"
  try {
    await initNextAction()
  } catch (err) {
    console.error('[startup] could not load Next Action', err)
  }
  try {
    await initCalendar()
  } catch (err) {
    console.error('[startup] could not start the calendar', err)
  }
  try {
    await initFocus()
  } catch (err) {
    console.error('[startup] could not load Focus', err)
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

  registerIpc({
    openSettings,
    openBoard: () => {
      showMainWindow()
      changeSettings({ ui: { tab: 'home' } }).catch((err) =>
        console.error('[settings] could not save', err)
      )
    },
    openTab
  })
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
  initPickupTray(pickupTray)
  initMusicTray(musicTray)

  // Clicking the Dock icon brings the board back, even if detached widgets are open.
  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
})

// Finish any pending saves before quitting, so the last change is never lost. Then exit for
// sure: a second, normal quit can be cut short (e.g. when the windows were already closed by
// a signal), which left Nuggit running with no windows and its menu bar icons behind.
let quitting = false
function saveAndExit(): void {
  if (quitting) return
  quitting = true
  prepareQuit()
  flushWrites()
    .catch((err) => console.error('[quit] could not finish saving', err))
    .finally(() => app.exit(0))
}

app.on('before-quit', (event) => {
  event.preventDefault()
  saveAndExit()
})

// Asked to stop from outside: `npm run dev` restarting after a code change, or the system
// shutting down.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, saveAndExit)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
