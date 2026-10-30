import { useCallback, useEffect, useState } from 'react'
import type { Settings, SettingsPatch } from '../../../shared/types'

export interface SettingsStore {
  settings: Settings | null
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
      const {
        dipPersonality,
        ui: uiPatch,
        dipTray,
        voice: voicePatch,
        calendar: calendarPatch,
        music: musicPatch,
        appearance: appearancePatch,
        ...rest
      } = patch
      const ui = { ...prev.ui }
      if (uiPatch?.tab) ui.tab = uiPatch.tab
      if (uiPatch?.settingsTab) ui.settingsTab = uiPatch.settingsTab
      if (uiPatch?.sidebarCollapsed !== undefined) ui.sidebarCollapsed = uiPatch.sidebarCollapsed
      if (uiPatch?.panel) ui.panels = { ...ui.panels, [uiPatch.panel.type]: uiPatch.panel.config }
      const { voiceURI, ...voiceRest } = voicePatch ?? {}
      const voice = { ...prev.voice, ...voiceRest }
      const { themeColor, ...appearanceRest } = appearancePatch ?? {}
      const appearance = { ...prev.appearance, ...appearanceRest }
      if (themeColor !== undefined) appearance.themeColor = themeColor ?? undefined
      if (voicePatch && 'voiceURI' in voicePatch) voice.voiceURI = voiceURI || undefined
      const next = {
        ...prev,
        ...rest,
        ai,
        ui,
        voice,
        calendar: { ...prev.calendar, ...calendarPatch },
        appearance,
        // Links are checked (and turned into URIs) by the main process: wait for those.
        music: {
          ...prev.music,
          ...(musicPatch?.enabled !== undefined ? { enabled: musicPatch.enabled } : {}),
          ...(musicPatch?.onBreak ? { onBreak: musicPatch.onBreak } : {})
        },
        dipTray: { ...prev.dipTray, ...dipTray }
      }
      if (dipPersonality !== undefined) next.dipPersonality = dipPersonality?.trim() || undefined
      return next
    })
    window.api.settings
      .update(patch)
      .then(setSettings)
      .catch((err) => console.error('Could not save settings', err))
  }, [])

  return { settings, update }
}
