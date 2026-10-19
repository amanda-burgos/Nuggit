import type { ThemePreference } from '../../../shared/types'
import type { SectionProps } from './shared'

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '🖥️ Como el sistema' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Oscuro' }
]

// Colors and backgrounds come in Fase 9.
export function AppearanceSettings({ settings, update }: SectionProps): React.JSX.Element {
  return (
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
  )
}
