import { BrowserWindow, nativeTheme } from 'electron'
import type { Settings } from '../shared/types'
import { setDipTrayOptions } from './dipTray'
import { setStatusIndicator } from './statusTray'
import { setAIProvider, updateSettings } from './storage'

// Every settings change goes through here, whether it comes from a window or the menu bar,
// so the theme, the menu bar indicator and every open window stay in step.
export async function changeSettings(patch: unknown): Promise<Settings> {
  return applySettings(await updateSettings(patch))
}

export async function changeAIProvider(provider: Settings['ai']['provider']): Promise<Settings> {
  return applySettings(await setAIProvider(provider))
}

function applySettings(settings: Settings): Settings {
  // Every window (including detached widgets) follows the theme through the OS setting.
  nativeTheme.themeSource = settings.theme
  setStatusIndicator(settings.statusIndicator)
  setDipTrayOptions(settings.dipTray)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings:changed', settings)
  }
  return settings
}
