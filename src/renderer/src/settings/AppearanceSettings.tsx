import type { ThemePreference } from '../../../shared/types'
import {
  DEFAULT_FONT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  WIDGET_RADIUS_MAX,
  WIDGET_RADIUS_MIN
} from '../../../shared/types'
import { ACCENT_PRESETS, isDarkColor } from '../theme/appearance'
import { BackgroundPicker } from '../theme/BackgroundPicker'
import { FontPicker, FontSelect } from '../theme/FontPicker'
import type { SectionProps } from './shared'

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: '🖥️ Como el sistema' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Oscuro' }
]

// Fase 9: theme, accent color, the board's background and how widgets look.
export function AppearanceSettings({ settings, update }: SectionProps): React.JSX.Element {
  const { appearance } = settings
  const custom = !ACCENT_PRESETS[appearance.accent]
  const { themeColor } = appearance
  // Light/dark follows the chosen color, so menus and native controls match it too.
  const chooseThemeColor = (color: string): void =>
    update({ theme: isDarkColor(color) ? 'dark' : 'light', appearance: { themeColor: color } })

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
              checked={!themeColor && settings.theme === t.value}
              onChange={() => update({ theme: t.value, appearance: { themeColor: null } })}
            />
            {t.label}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="theme"
            checked={!!themeColor}
            onChange={() => chooseThemeColor(themeColor ?? '#2b2350')}
          />
          🎨 Mi color
          <span className={`theme-color-choice${themeColor ? '' : ' is-off'}`}>
            <input
              type="color"
              aria-label="Color de la app"
              value={themeColor ?? '#2b2350'}
              onChange={(e) => chooseThemeColor(e.target.value)}
            />
          </span>
        </label>
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

      <div className="settings-subsection">
        <h4>🔤 Letra</h4>
        <div className="settings-field">
          <span>Fuente</span>
          <FontPicker
            value={appearance.font}
            onChange={(font) => update({ appearance: { font } })}
          />
        </div>

        <div className="settings-field">
          <span>Fuente de los títulos</span>
          <FontSelect
            ariaLabel="Fuente de los títulos"
            value={appearance.headingFont ?? null}
            generalLabel="Igual que el texto"
            onChange={(headingFont) => update({ appearance: { headingFont } })}
          />
        </div>

        <label className="settings-field">
          <span>Tamaño de la letra: {Math.round(appearance.fontScale * 100)}%</span>
          <input
            type="range"
            className="settings-range"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={0.05}
            value={appearance.fontScale}
            onChange={(e) => update({ appearance: { fontScale: Number(e.target.value) } })}
          />
          <small>
            Cambia el tamaño del texto en toda la app, también en los widgets despegados.
          </small>
        </label>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={appearance.fontAuto}
            onChange={(e) => update({ appearance: { fontAuto: e.target.checked } })}
          />
          <span>
            Ajustar al tamaño de la ventana
            <small>
              Con la ventana chica la letra se achica y con la ventana grande crece. Los widgets
              despegados quedan igual.
            </small>
          </span>
        </label>

        <p className="font-size-preview">
          Así se ve: <strong>Termina un tender de 10 minutos</strong> y luego toma agua. 🌱
        </p>

        {(appearance.font !== DEFAULT_FONT ||
          appearance.headingFont ||
          appearance.fontScale !== 1 ||
          !appearance.fontAuto) && (
          <button
            type="button"
            className="bg-choice is-text"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              update({
                appearance: { font: DEFAULT_FONT, headingFont: null, fontScale: 1, fontAuto: true }
              })
            }
          >
            Volver a la letra de siempre
          </button>
        )}
        <small>Cada widget puede tener su propia letra desde su ⚙︎.</small>
      </div>

      <div className="settings-field">
        <span>Fondo del tablero (Inicio)</span>
        <BackgroundPicker
          value={appearance.board}
          onChange={(board) => board && update({ appearance: { board } })}
        />
      </div>

      {appearance.board.kind !== 'default' && (
        <>
          <label className="settings-field">
            <span>
              Transparencia del fondo:{' '}
              {appearance.boardOpacity >= 1
                ? 'ninguna'
                : `${Math.round((1 - appearance.boardOpacity) * 100)}%`}
            </span>
            <input
              type="range"
              className="settings-range"
              min={0.1}
              max={1}
              step={0.05}
              value={appearance.boardOpacity}
              onChange={(e) => update({ appearance: { boardOpacity: Number(e.target.value) } })}
            />
          </label>

          <label className="settings-check">
            <input
              type="checkbox"
              checked={appearance.boardEverywhere}
              onChange={(e) => update({ appearance: { boardEverywhere: e.target.checked } })}
            />
            <span>
              Usarlo también en las otras pestañas
              <small>Tareas, Notas, Focus, Ajustes… todas con el mismo fondo.</small>
            </span>
          </label>
        </>
      )}

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

        <label className="settings-field">
          <span>
            Esquinas: {appearance.widgetRadius === 0 ? 'rectas' : `${appearance.widgetRadius} px`}
          </span>
          <input
            type="range"
            className="settings-range"
            min={WIDGET_RADIUS_MIN}
            max={WIDGET_RADIUS_MAX}
            step={1}
            value={appearance.widgetRadius}
            onChange={(e) => update({ appearance: { widgetRadius: Number(e.target.value) } })}
          />
          <small>Cada widget puede tener las suyas desde su ⚙︎.</small>
        </label>

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
