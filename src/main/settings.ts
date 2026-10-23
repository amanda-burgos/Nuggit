import { BrowserWindow, nativeTheme } from 'electron'
import type { Settings } from '../shared/types'
import { applyCalendarSettings } from './calendar'
import { setDipTrayOptions } from './dipTray'
import { spotifyInstalled } from './music'
import { setMusicTrayMode } from './musicTray'
import { setPickupMode } from './pickupTray'
import { setStatusIndicator } from './statusTray'
import { setAIProvider, updateSettings } from './storage'

// Every settings change goes through here, whether it comes from a window or the menu bar,
// so the theme, the menu bar indicator and every open window stay in step.
export async function changeSettings(patch: unknown): Promise<Settings> {
  const settings = applySettings(await updateSettings(patch))
  // The calendar feed and the Mac's Calendar sync start or stop with their settings.
  if (typeof patch === 'object' && patch !== null && 'calendar' in patch) {
    applyCalendarSettings(settings).catch((err) => console.error('[calendar]', err))
  }
  return settings
}

export async function changeAIProvider(provider: Settings['ai']['provider']): Promise<Settings> {
  return applySettings(await setAIProvider(provider))
}

// Unless the person chose, the music icon shows only when Spotify is on this Mac.
export function musicTrayMode(settings: Settings): NonNullable<Settings['musicTray']> {
  return settings.musicTray ?? (spotifyInstalled() ? 'icon' : 'off')
}

function applySettings(settings: Settings): Settings {
  // Every window (including detached widgets) follows the theme through the OS setting.
  nativeTheme.themeSource = settings.theme
  setStatusIndicator(settings.statusIndicator)
  setDipTrayOptions(settings.dipTray)
  setPickupMode(settings.pickupTray)
  setMusicTrayMode(musicTrayMode(settings))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('settings:changed', settings)
  }
  return settings
}
