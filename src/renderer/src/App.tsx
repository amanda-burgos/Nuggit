import { useCallback, useEffect, useState } from 'react'
import { Desktop } from './desktop/Desktop'
import { Toolbar } from './desktop/Toolbar'
import { useDesktop } from './store/useDesktop'
import { SettingsPanel } from './settings/SettingsPanel'
import { useSettings } from './store/useSettings'

function App(): React.JSX.Element {
  const desktopStore = useDesktop()
  const { settings, setTheme, update } = useSettings()
  const { desktop } = desktopStore
  const [settingsOpen, setSettingsOpen] = useState(false)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  // Any window (e.g. a detached Dip widget) can ask to open Settings here.
  useEffect(() => window.api.app.onOpenSettings(() => setSettingsOpen(true)), [])

  if (!desktop) return <div className="app" />

  return (
    <div className="app">
      <Toolbar
        widgets={desktop.widgets}
        detached={desktop.detached}
        theme={settings?.theme ?? 'system'}
        onAdd={desktopStore.addWidget}
        onShow={(id) => desktopStore.setHidden(id, false)}
        onAttach={desktopStore.attachWidget}
        onRemoveAll={desktopStore.removeAllWidgets}
        onThemeChange={setTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Desktop desktop={desktop} store={desktopStore} />
      {settingsOpen && (
        <SettingsPanel settings={settings} update={update} onClose={closeSettings} />
      )}
    </div>
  )
}

export default App
