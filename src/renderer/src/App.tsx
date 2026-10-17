import { useCallback, useEffect } from 'react'
import type { AppTab } from '../../shared/types'
import { Desktop } from './desktop/Desktop'
import { Toolbar } from './desktop/Toolbar'
import { SettingsPanel } from './settings/SettingsPanel'
import { FullPanel } from './shell/FullPanel'
import { Sidebar } from './shell/Sidebar'
import { TABS } from './shell/tabs'
import './shell/shell.css'
import { useDesktop } from './store/useDesktop'
import { useSettings } from './store/useSettings'

// The control center (SPEC 9.0): a sidebar with tabs, each one a full-size panel.
function App(): React.JSX.Element {
  const desktopStore = useDesktop()
  const { settings, update } = useSettings()
  const { desktop } = desktopStore
  const tab = settings?.ui.tab ?? 'home'
  const collapsed = settings?.ui.sidebarCollapsed ?? false

  const selectTab = useCallback((next: AppTab) => update({ ui: { tab: next } }), [update])

  // Any window (e.g. a detached Dip widget) can ask to open Settings here.
  useEffect(() => window.api.app.onOpenSettings(() => selectTab('settings')), [selectTab])

  // ⌘1 Inicio, ⌘2 Dip, ⌘3 Tareas, ⌘4 Ahora, ⌘5 Tenderizer, ⌘6 Dailies, ⌘, Ajustes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const target = TABS.find((t) => t.shortcut === e.key)
      if (!target) return
      e.preventDefault()
      selectTab(target.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectTab])

  if (!desktop || !settings) return <div className="app" />

  const widgetType = TABS.find((t) => t.key === tab)?.widgetType

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        collapsed={collapsed}
        onSelect={selectTab}
        onToggleCollapsed={() => update({ ui: { sidebarCollapsed: !collapsed } })}
      />
      <main className="app-main">
        {tab === 'home' && (
          <>
            <Toolbar
              widgets={desktop.widgets}
              detached={desktop.detached}
              onAdd={desktopStore.addWidget}
              onShow={(id) => desktopStore.setHidden(id, false)}
              onAttach={desktopStore.attachWidget}
              onRemoveAll={desktopStore.removeAllWidgets}
            />
            <Desktop desktop={desktop} store={desktopStore} />
          </>
        )}
        {widgetType && (
          <FullPanel key={widgetType} type={widgetType} settings={settings} update={update} />
        )}
        {tab === 'settings' && <SettingsPanel settings={settings} update={update} />}
      </main>
    </div>
  )
}

export default App
