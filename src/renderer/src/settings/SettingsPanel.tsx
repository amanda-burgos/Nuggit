import type { Settings, SettingsPatch, ThemePreference } from '../../../shared/types'
import { TasksSettings } from '../widgets/tasks/TasksSettings'
import { AISettings } from './AISettings'
import { DipPersonality } from './DipPersonality'
import { DipTraySettings } from './DipTraySettings'
import './settings.css'

interface Props {
  settings: Settings
  update(patch: SettingsPatch): void
}

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '🖥️ Como el sistema' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Oscuro' }
]

// The Ajustes tab.
export function SettingsPanel({ settings, update }: Props): React.JSX.Element {
  return (
    <div className="panel">
      <header className="panel-header">
        <h1>
          <span aria-hidden>⚙︎</span> Ajustes
        </h1>
      </header>
      <div className="panel-body">
        <div className="settings-page">
          <AISettings settings={settings} update={update} />
          <DipPersonality settings={settings} update={update} />

          <section className="settings-section">
            <h3>📍 Barra de menú</h3>
            <TasksSettings />
            <DipTraySettings settings={settings} update={update} />
          </section>

          <section className="settings-section">
            <h3>🎨 Apariencia</h3>
            <fieldset className="settings-choices">
              <legend>Tema</legend>
              {THEMES.map((t) => (
                <label key={t.value}>
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === t.value}
                    onChange={() => update({ theme: t.value })}
                  />
                  {t.label}
                </label>
              ))}
            </fieldset>
          </section>
        </div>
      </div>
    </div>
  )
}
