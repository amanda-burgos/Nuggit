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
import { MusicSettings } from './MusicSettings'
import type { SectionProps } from './shared'
import { VoiceSettings } from './VoiceSettings'
import { t } from '../../../shared/i18n'
import './settings.css'

interface Props {
  settings: Settings
  update(patch: SettingsPatch): void
}

const tabs = (): Array<{ key: SettingsTab; label: string; icon: string }> => [
  { key: 'general', label: 'General', icon: '⚙︎' },
  { key: 'appearance', label: t('Apariencia', 'Appearance'), icon: '🎨' },
  { key: 'dip', label: 'Dip', icon: '💬' },
  { key: 'ai', label: t('IA y proveedores', 'AI and providers'), icon: '🤖' },
  { key: 'voice', label: t('Voz', 'Voice'), icon: '🎙️' },
  { key: 'calendar', label: t('Calendario', 'Calendar'), icon: '📅' },
  { key: 'music', label: t('Música', 'Music'), icon: '🎵' },
  { key: 'menubar', label: t('Barra de menú', 'Menu bar'), icon: '📍' },
  { key: 'about', label: t('Acerca de', 'About'), icon: 'ℹ️' }
]

// Every block of Ajustes, with the words the search box finds it by (Spanish and English, so
// search works in either language).
const SECTIONS: Array<{
  id: string
  tab: SettingsTab
  keywords: string
  Component: React.FC<SectionProps>
}> = [
  {
    id: 'general',
    tab: 'general',
    keywords:
      "general iniciar login arranque abrir al iniciar idioma language english inglés español atajos teclado shortcuts novedades qué hay de nuevo actualización tour start launch open at login language spanish shortcuts keyboard what's new whats news update tour",
    Component: GeneralSettings
  },
  {
    id: 'appearance',
    tab: 'appearance',
    keywords:
      'apariencia tema claro oscuro sistema mi color colores fondo transparencia letra fuente fuentes tipografía font tamaño texto títulos dislexia appearance theme light dark system my color colors background transparency font fonts typography size text titles dyslexia',
    Component: AppearanceSettings
  },
  {
    id: 'personality',
    tab: 'dip',
    keywords:
      'dip personalidad estilo como habla pirata original personality style how it talks pirate',
    Component: DipPersonality
  },
  {
    id: 'ai',
    tab: 'ai',
    keywords:
      'ia inteligencia artificial proveedor gemini ollama servidor propio key api modelo orden automatico agentes compartir tareas env ai artificial intelligence provider own server custom model order automatic agents share tasks',
    Component: AISettings
  },
  {
    id: 'voice',
    tab: 'voice',
    keywords:
      'voz voces hablar habla velocidad tono probar mejorada premium dictado microfono voice voices speak talk speed rate pitch test enhanced premium dictation microphone mic',
    Component: VoiceSettings
  },
  {
    id: 'call',
    tab: 'voice',
    keywords:
      'llamada llamar modo llamada transcripcion whisper microfono manos libres call calling call mode transcription microphone mic hands free',
    Component: CallSettings
  },
  {
    id: 'calendar',
    tab: 'calendar',
    keywords:
      'calendario apple google ics exportar suscripcion sincronizar eventos mac icloud webcal calendar export subscription subscribe sync events',
    Component: CalendarSettings
  },
  {
    id: 'music',
    tab: 'music',
    keywords: 'musica spotify playlist focus pomodoro descanso cancion music break song',
    Component: MusicSettings
  },
  {
    id: 'menubar',
    tab: 'menubar',
    keywords:
      'barra de menu icono indicador en curso puntito mini chat atajo quick pickup widgets musica reproductor menu bar icon indicator in progress dot shortcut music player',
    Component: MenuBarSettings
  },
  {
    id: 'about',
    tab: 'about',
    keywords:
      "acerca version novedades changelog datos carpeta about version what's new whats data folder",
    Component: AboutSettings
  }
]

const normalize = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// The Ajustes tab (SPEC 9.0): its own tabs, plus a search box that finds any setting.
export function SettingsPanel({ settings, update }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const tab = settings.ui.settingsTab ?? 'general'
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const TABS = tabs()
  const tabLabel = (key: SettingsTab): string => TABS.find((tb) => tb.key === key)!.label

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
          <span aria-hidden>⚙︎</span> {t('Ajustes', 'Settings')}
        </h1>
      </header>
      <div className="panel-body">
        <div className="settings-page">
          <input
            type="search"
            className="settings-search"
            value={query}
            placeholder={t('Buscar un ajuste…', 'Search settings…')}
            aria-label={t('Buscar un ajuste', 'Search settings')}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!words.length && (
            <nav
              className="settings-tabs"
              role="tablist"
              aria-label={t('Secciones de Ajustes', 'Settings sections')}
            >
              {TABS.map((tb) => (
                <button
                  key={tb.key}
                  role="tab"
                  aria-selected={tb.key === tab}
                  className={`settings-tab${tb.key === tab ? ' is-active' : ''}`}
                  onClick={() => update({ ui: { settingsTab: tb.key } })}
                >
                  <span aria-hidden>{tb.icon}</span> {tb.label}
                </button>
              ))}
            </nav>
          )}

          {shown.length === 0 && (
            <p className="settings-hint">
              {t('No encontré ningún ajuste así.', "I couldn't find a setting like that.")}
            </p>
          )}
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
                  {t('En', 'In')} {tabLabel(sectionTab)} →
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
