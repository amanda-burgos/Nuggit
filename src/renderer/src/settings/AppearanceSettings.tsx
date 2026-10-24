import type { ThemePreference, WidgetCorners } from '../../../shared/types'
import { ACCENT_PRESETS } from '../theme/appearance'
import { BackgroundPicker } from '../theme/BackgroundPicker'
import type { SectionProps } from './shared'

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '🖥️ Como el sistema' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Oscuro' }
]

const CORNERS: Array<{ value: WidgetCorners; label: string }> = [
  { value: 'square', label: 'Rectas' },
  { value: 'soft', label: 'Suaves' },
  { value: 'round', label: 'Muy redondas' }
]

// Fase 9: theme, accent color, the board's background and how widgets look.
export function AppearanceSettings({ settings, update }: SectionProps): React.JSX.Element {
  const { appearance } = settings
  const custom = !ACCENT_PRESETS[appearance.accent]

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

      <div className="settings-field">
        <span>Color de acento</span>
        <div className="accent-picker" role="radiogroup" aria-label="Color de acento">
          {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={appearance.accent === key}
              className={`accent-choice${appearance.accent === key ? ' is-active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${preset.light}, ${preset.dark})` }}
              title={preset.name}
              aria-label={preset.name}
              onClick={() => update({ appearance: { accent: key } })}
            />
          ))}
          <label
            className={`accent-choice is-custom${custom ? ' is-active' : ''}`}
            title="Otro color"
            style={custom ? { background: appearance.accent } : undefined}
          >
            <input
              type="color"
              aria-label="Otro color de acento"
              value={custom ? appearance.accent : '#8b72dd'}
              onChange={(e) => update({ appearance: { accent: e.target.value } })}
            />
          </label>
        </div>
      </div>

      <div className="settings-field">
        <span>Fondo del tablero (Inicio)</span>
        <BackgroundPicker
          value={appearance.board}
          onChange={(board) => board && update({ appearance: { board } })}
        />
      </div>

      <div className="settings-subsection">
        <h4>🧩 Widgets</h4>
        <div className="settings-field">
          <span>Fondo de todos los widgets</span>
          <BackgroundPicker
            value={appearance.widgetBackground}
            onChange={(widgetBackground) =>
              widgetBackground && update({ appearance: { widgetBackground } })
            }
          />
          <small>
            Cada widget puede tener el suyo desde su ⚙︎. Con imagen, se pone un velo suave para que
            el texto se lea bien.
          </small>
        </div>

        <label className="settings-field">
          <span>
            Transparencia:{' '}
            {appearance.widgetOpacity >= 1
              ? 'ninguna'
              : `${Math.round((1 - appearance.widgetOpacity) * 100)}%`}
          </span>
          <input
            type="range"
            className="settings-range"
            min={0.6}
            max={1}
            step={0.05}
            value={appearance.widgetOpacity}
            onChange={(e) => update({ appearance: { widgetOpacity: Number(e.target.value) } })}
          />
        </label>

        <fieldset className="settings-choices">
          <legend>Esquinas</legend>
          {CORNERS.map((c) => (
            <label key={c.value}>
              <input
                type="radio"
                name="widget-corners"
                checked={appearance.widgetCorners === c.value}
                onChange={() => update({ appearance: { widgetCorners: c.value } })}
              />
              {c.label}
            </label>
          ))}
        </fieldset>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={appearance.widgetShadow}
            onChange={(e) => update({ appearance: { widgetShadow: e.target.checked } })}
          />
          <span>
            Sombra en el tablero
            <small>Los widgets despegados tienen su propia opción de sombra en su ⚙︎.</small>
          </span>
        </label>
      </div>
    </section>
  )
}
