import { Desktop } from './desktop/Desktop'
import { Toolbar } from './desktop/Toolbar'
import { useDesktop } from './store/useDesktop'
import { useSettings } from './store/useSettings'

function App(): React.JSX.Element {
  const desktopStore = useDesktop()
  const { settings, setTheme } = useSettings()
  const { desktop } = desktopStore

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
        onThemeChange={setTheme}
      />
      <Desktop desktop={desktop} store={desktopStore} />
    </div>
  )
}

export default App
