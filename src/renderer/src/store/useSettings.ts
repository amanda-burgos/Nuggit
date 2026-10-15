import { useCallback, useEffect, useState } from 'react'
import type { Settings, SettingsPatch, ThemePreference } from '../../../shared/types'

export interface SettingsStore {
  settings: Settings | null
  setTheme(theme: ThemePreference): void
  update(patch: SettingsPatch): void
}

export function useSettings(): SettingsStore {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.api.settings
      .load()
      .then(setSettings)
      .catch((err) => console.error('Could not load settings', err))
    // Settings can also change from another window or the menu bar.
    return window.api.settings.onChange(setSettings)
  }, [])

  // Apply the theme to <html>; "system" follows the OS.
  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [settings?.theme])

  const update = useCallback((patch: SettingsPatch) => {
    setSettings((prev) => {
      if (!prev) return prev
      const ai = { ...prev.ai }
      if (patch.ai?.shareTasksWithAI !== undefined) ai.shareTasksWithAI = patch.ai.shareTasksWithAI
      for (const key of ['model', 'ollamaModel'] as const) {
        if (patch.ai && key in patch.ai) ai[key] = patch.ai[key] || undefined
      }
      const { dipPersonality, ...rest } = patch
      const next = { ...prev, ...rest, ai }
      if (dipPersonality !== undefined) next.dipPersonality = dipPersonality?.trim() || undefined
      return next
    })
    window.api.settings
      .update(patch)
      .then(setSettings)
      .catch((err) => console.error('Could not save settings', err))
  }, [])

  const setTheme = useCallback((theme: ThemePreference) => update({ theme }), [update])

  return { settings, setTheme, update }
}
