import { useCallback, useEffect, useRef, useState } from 'react'
import { newestDate, releaseFor, unseenCount, type ChangelogRelease } from '../../shared/changelog'
import type { AppTab } from '../../shared/types'
import { Desktop } from './desktop/Desktop'
import { Toolbar } from './desktop/Toolbar'
import { HelpPanel } from './help/HelpPanel'
import { RELEASES } from './help/news'
import { LanguagePicker } from './help/LanguagePicker'
import { Tour } from './help/Tour'
import { NewsPanel } from './help/NewsPanel'
import { UpdateNotice } from './help/UpdateNotice'
import { WhatsNew } from './help/WhatsNew'
import { SettingsPanel } from './settings/SettingsPanel'
import { FullPanel } from './shell/FullPanel'
import { Sidebar } from './shell/Sidebar'
import { TABS } from './shell/tabs'
import './shell/shell.css'
import { useDesktop } from './store/useDesktop'
import { newQuickNote } from './store/useNotes'
import { IS_MAC } from '../../shared/keys'
import { useSettings } from './store/useSettings'

// The control center (SPEC 9.0): a sidebar with tabs, each one a full-size panel.
function App(): React.JSX.Element {
  const desktopStore = useDesktop()
  const { settings, update } = useSettings()
  const { desktop } = desktopStore
  const tab = settings?.ui.tab ?? 'home'
  const collapsed = settings?.ui.sidebarCollapsed ?? false

  const selectTab = useCallback((next: AppTab) => update({ ui: { tab: next } }), [update])

  // Fase 10: the welcome tour (first time), "Qué hay de nuevo" (after an update) and the
  // 📣 Novedades panel.
  const [touring, setTouring] = useState(false)
  const [news, setNews] = useState<{ release: ChangelogRelease; version: string } | null>(null)
  const [newsOpen, setNewsOpen] = useState(false)
  const greeted = useRef(false)

  useEffect(() => {
    // Fase 14: first the language (if it was never chosen), then the tour.
    if (!settings || !settings.language || greeted.current) return
    greeted.current = true
    const { onboarding } = settings
    window.api.app
      .info()
      .then(({ version }) => {
        if (!onboarding.tourDone) {
          setTouring(true)
          selectTab('home')
        }
        if (onboarding.lastSeenVersion === version) return
        // Only after an update: a new person gets the tour instead.
        const release = releaseFor(RELEASES, version)
        if (onboarding.tourDone && onboarding.lastSeenVersion && onboarding.whatsNew && release) {
          setNews({ release, version })
        }
        update({ onboarding: { lastSeenVersion: version } })
      })
      .catch((err) => console.error('Could not check the version', err))
  }, [settings, selectTab, update])

  const startTour = (): void => {
    selectTab('home')
    setTouring(true)
  }
  const finishTour = (): void => {
    setTouring(false)
    update({ onboarding: { tourDone: true } })
  }
  // 📣 Novedades: opening it counts everything in it as seen (the dot goes away).
  const openNews = (): void => {
    setNews(null)
    setNewsOpen(true)
    const newest = newestDate(RELEASES)
    if (newest) update({ onboarding: { lastSeenNews: newest } })
  }

  // Any window (e.g. a detached Dip widget) can ask to open Settings here.
  useEffect(() => window.api.app.onOpenSettings(() => selectTab('settings')), [selectTab])

  // ⌘1 Inicio, ⌘2 Dip, ⌘3 Tareas, ⌘4 Ahora, ⌘5 Tenderizer, ⌘6 Dailies, ⌘7 Notas,
  // ⌘8 Brain Dump, ⌘9 Focus, ⌘0 Calendario, ⌘, Ajustes. ⌘N: a new quick note (SPEC 9.7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Mac: ⌘ (or ⌃, as before). Windows/Linux: Ctrl only (the Windows key belongs to the system).
      const mod = IS_MAC ? e.metaKey || e.ctrlKey : e.ctrlKey && !e.metaKey
      if (!mod || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newQuickNote()
          .then(() => selectTab('notes'))
          .catch((err) => console.error('Could not create a note', err))
        return
      }
      const target = TABS.find((t) => t.shortcut === e.key)
      if (!target) return
      e.preventDefault()
      selectTab(target.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectTab])

  if (!desktop || !settings) return <div className="app" />
  if (!settings.language) return <LanguagePicker onPick={(language) => update({ language })} />

  const widgetType = TABS.find((t) => t.key === tab)?.widgetType
  const { board, boardEverywhere } = settings.appearance
  const backdrop = board.kind !== 'default' && (tab === 'home' || boardEverywhere)

  return (
    <div className="app">
      <Sidebar
        tab={tab}
        collapsed={collapsed}
        onSelect={selectTab}
        onToggleCollapsed={() => update({ ui: { sidebarCollapsed: !collapsed } })}
        newsCount={unseenCount(RELEASES, settings.onboarding.lastSeenNews)}
        onOpenNews={openNews}
      />
      <main className={`app-main${backdrop ? ' has-backdrop' : ''}`}>
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
        {tab === 'help' && (
          <HelpPanel update={update} onStartTour={startTour} onOpenNews={openNews} />
        )}
        {tab === 'settings' && <SettingsPanel settings={settings} update={update} />}
      </main>
      {touring && <Tour onDone={finishTour} />}
      {!touring && <UpdateNotice />}
      {newsOpen && <NewsPanel onClose={() => setNewsOpen(false)} />}
      {news && !touring && (
        <WhatsNew
          release={news.release}
          version={news.version}
          onSeeAll={openNews}
          onClose={() => setNews(null)}
        />
      )}
    </div>
  )
}

export default App
