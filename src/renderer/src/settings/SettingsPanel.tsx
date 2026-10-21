import { useState } from 'react'
import type { Settings, SettingsPatch, SettingsTab } from '../../../shared/types'
import { AboutSettings } from './AboutSettings'
import { AISettings } from './AISettings'
import { AppearanceSettings } from './AppearanceSettings'
import { CalendarSettings } from './CalendarSettings'
import { CallSettings } from './CallSettings'
import { DipPersonality } from './DipPersonality'
import { GeneralSettings } from './GeneralSettings'
import { MenuBarSettings } from './MenuBarSettings'
import type { SectionProps } from './shared'
import { VoiceSettings } from './VoiceSettings'
import './settings.css'

interface Props {
  settings: Settings
  update(patch: SettingsPatch): void
}

const TABS: Array<{ key: SettingsTab; label: string; icon: string }> = [
  { key: 'general', label: 'General', icon: '⚙︎' },
  { key: 'appearance', label: 'Apariencia', icon: '🎨' },
  { key: 'dip', label: 'Dip', icon: '💬' },
  { key: 'ai', label: 'IA y proveedores', icon: '🤖' },
  { key: 'voice', label: 'Voz', icon: '🎙️' },
  { key: 'calendar', label: 'Calendario', icon: '📅' },
  { key: 'menubar', label: 'Barra de menú', icon: '📍' },
  { key: 'about', label: 'Acerca de', icon: 'ℹ️' }
]

// Every block of Ajustes, with the words the search box finds it by.
const SECTIONS: Array<{
  id: string
  tab: SettingsTab
  keywords: string
  Component: React.FC<SectionProps>
}> = [
  {
    id: 'general',
    tab: 'general',
    keywords: 'general iniciar login arranque abrir al iniciar idioma atajos teclado shortcuts',
    Component: GeneralSettings
  },
  {
    id: 'appearance',
    tab: 'appearance',
    keywords: 'apariencia tema claro oscuro sistema colores fondo',
    Component: AppearanceSettings
  },
  {
    id: 'personality',
    tab: 'dip',
    keywords: 'dip personalidad estilo como habla pirata original',
    Component: DipPersonality
  },
  {
    id: 'ai',
    tab: 'ai',
    keywords:
      'ia inteligencia artificial proveedor gemini ollama servidor propio key api modelo orden automatico agentes compartir tareas env',
    Component: AISettings
  },
  {
    id: 'voice',
    tab: 'voice',
    keywords: 'voz voces hablar habla velocidad tono probar mejorada premium dictado microfono',
    Component: VoiceSettings
  },
  {
    id: 'call',
    tab: 'voice',
    keywords: 'llamada llamar modo llamada transcripcion whisper microfono manos libres',
    Component: CallSettings
  },
  {
    id: 'calendar',
    tab: 'calendar',
    keywords:
      'calendario apple google ics exportar suscripcion sincronizar eventos mac icloud webcal',
    Component: CalendarSettings
  },
  {
    id: 'menubar',
    tab: 'menubar',
    keywords: 'barra de menu icono indicador en curso puntito mini chat atajo quick pickup widgets',
    Component: MenuBarSettings
  },
  {
    id: 'about',
    tab: 'about',
    keywords: 'acerca version novedades changelog datos carpeta',
    Component: AboutSettings
  }
]

const normalize = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// The Ajustes tab (SPEC 9.0): its own tabs, plus a search box that finds any setting.
export function SettingsPanel({ settings, update }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const tab = settings.ui.settingsTab ?? 'general'
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const tabLabel = (key: SettingsTab): string => TABS.find((t) => t.key === key)!.label

  const shown = words.length
    ? SECTIONS.filter((s) => {
        const haystack = normalize(`${s.keywords} ${tabLabel(s.tab)}`)
        return words.every((w) => haystack.includes(w))
      })
    : SECTIONS.filter((s) => s.tab === tab)

  return (
    <div className="panel">
      <header className="panel-header">
        <h1>
          <span aria-hidden>⚙︎</span> Ajustes
        </h1>
      </header>
      <div className="panel-body">
        <div className="settings-page">
          <input
            type="search"
            className="settings-search"
            value={query}
            placeholder="Buscar un ajuste…"
            aria-label="Buscar un ajuste"
            onChange={(e) => setQuery(e.target.value)}
          />
          {!words.length && (
            <nav className="settings-tabs" role="tablist" aria-label="Secciones de Ajustes">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={t.key === tab}
                  className={`settings-tab${t.key === tab ? ' is-active' : ''}`}
                  onClick={() => update({ ui: { settingsTab: t.key } })}
                >
                  <span aria-hidden>{t.icon}</span> {t.label}
                </button>
              ))}
            </nav>
          )}

          {shown.length === 0 && <p className="settings-hint">No encontré ningún ajuste así.</p>}
          {shown.map(({ id, tab: sectionTab, Component }) => (
            <div key={id} className="settings-block">
              {words.length > 0 && (
                <button
                  className="settings-found-in"
                  onClick={() => {
                    setQuery('')
                    update({ ui: { settingsTab: sectionTab } })
                  }}
                >
                  En {tabLabel(sectionTab)} →
                </button>
              )}
              <Component settings={settings} update={update} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
