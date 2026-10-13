import { BrowserWindow, nativeTheme } from 'electron'
import type { Settings } from '../shared/types'
import { setStatusIndicator } from './statusTray'
import { updateSettings } from './storage'

// Every settings change goes through here, whether it comes from a window or the menu bar,
// so the theme, the menu bar indicator and every open window stay in step.
export async function changeSettings(patch: unknown): Promise<Settings> {
  const settings = await updateSettings(patch)
  // Every window (including detached widgets) follows the theme through the OS setting.
  nativeTheme.themeSource = settings.theme
  setStatusIndicator(settings.statusIndicator)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings:changed', settings)
  }
  return settings
}
