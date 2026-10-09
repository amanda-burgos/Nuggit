import { useCallback, useEffect, useState } from 'react'
import type { Settings, ThemePreference } from '../../../shared/types'

export interface SettingsStore {
  settings: Settings | null
  setTheme(theme: ThemePreference): void
}

export function useSettings(): SettingsStore {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.api.settings
      .load()
      .then(setSettings)
      .catch((err) => console.error('Could not load settings', err))
  }, [])

  // Apply the theme to <html>; "system" follows the OS.
  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [settings?.theme])

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((prev) => (prev ? { ...prev, theme } : prev))
    window.api.settings
      .update({ theme })
      .then(setSettings)
      .catch((err) => console.error('Could not save settings', err))
  }, [])

  return { settings, setTheme }
}
