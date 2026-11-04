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
import { t } from '../../../shared/i18n'

const themes = (): Array<{ value: ThemePreference; label: string }> => [
  { value: 'system', label: t('🖥️ Como el sistema', '🖥️ Same as system') },
  { value: 'light', label: t('☀️ Claro', '☀️ Light') },
  { value: 'dark', label: t('🌙 Oscuro', '🌙 Dark') }
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
      <h3>🎨 {t('Apariencia', 'Appearance')}</h3>

      <fieldset className="settings-choices">
        <legend>{t('Tema', 'Theme')}</legend>
        {themes().map((th) => (
          <label key={th.value}>
            <input
              type="radio"
              name="theme"
              checked={!themeColor && settings.theme === th.value}
              onChange={() => update({ theme: th.value, appearance: { themeColor: null } })}
            />
            {th.label}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="theme"
            checked={!!themeColor}
            onChange={() => chooseThemeColor(themeColor ?? '#2b2350')}
          />
          🎨 {t('Mi color', 'My color')}
          <span className={`theme-color-choice${themeColor ? '' : ' is-off'}`}>
            <input
              type="color"
              aria-label={t('Color de la app', 'App color')}
              value={themeColor ?? '#2b2350'}
              onChange={(e) => chooseThemeColor(e.target.value)}
            />
          </span>
        </label>
      </fieldset>

      <div className="settings-field">
        <span>{t('Color de acento', 'Accent color')}</span>
        <div
          className="accent-picker"
          role="radiogroup"
          aria-label={t('Color de acento', 'Accent color')}
        >
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
            title={t('Otro color', 'Another color')}
            style={custom ? { background: appearance.accent } : undefined}
          >
            <input
              type="color"
              aria-label={t('Otro color de acento', 'Another accent color')}
              value={custom ? appearance.accent : '#8b72dd'}
              onChange={(e) => update({ appearance: { accent: e.target.value } })}
            />
          </label>
        </div>
      </div>

      <div className="settings-subsection">
        <h4>🔤 {t('Letra', 'Text')}</h4>
        <div className="settings-field">
          <span>{t('Fuente', 'Font')}</span>
          <FontPicker
            value={appearance.font}
            onChange={(font) => update({ appearance: { font } })}
          />
        </div>

        <div className="settings-field">
          <span>{t('Fuente de los títulos', 'Title font')}</span>
          <FontSelect
            ariaLabel={t('Fuente de los títulos', 'Title font')}
            value={appearance.headingFont ?? null}
            generalLabel={t('Igual que el texto', 'Same as the text')}
            onChange={(headingFont) => update({ appearance: { headingFont } })}
          />
        </div>

        <label className="settings-field">
          <span>
            {t('Tamaño de la letra', 'Text size')}: {Math.round(appearance.fontScale * 100)}%
          </span>
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
            {t(
              'Cambia el tamaño del texto en toda la app, también en los widgets despegados.',
              'Changes the text size across the whole app, popped-out widgets too.'
            )}
          </small>
        </label>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={appearance.fontAuto}
            onChange={(e) => update({ appearance: { fontAuto: e.target.checked } })}
          />
          <span>
            {t('Ajustar al tamaño de la ventana', 'Fit to the window size')}
            <small>
              {t(
                'Con la ventana chica la letra se achica y con la ventana grande crece. Los widgets despegados quedan igual.',
                'With a small window the text shrinks and with a big window it grows. Popped-out widgets stay the same.'
              )}
            </small>
          </span>
        </label>

        <p className="font-size-preview">
          {t('Así se ve:', 'This is how it looks:')}{' '}
          <strong>{t('Termina un tender de 10 minutos', 'Finish a 10-minute tender')}</strong>{' '}
          {t('y luego toma agua. 🌱', 'and then drink some water. 🌱')}
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
            {t('Volver a la letra de siempre', 'Back to the usual text')}
          </button>
        )}
        <small>
          {t(
            'Cada widget puede tener su propia letra desde su ⚙︎.',
            'Each widget can have its own font from its ⚙︎.'
          )}
        </small>
      </div>

      <div className="settings-field">
        <span>{t('Fondo del tablero (Inicio)', 'Board background (Home)')}</span>
        <BackgroundPicker
          value={appearance.board}
          onChange={(board) => board && update({ appearance: { board } })}
        />
      </div>

      {appearance.board.kind !== 'default' && (
        <>
          <label className="settings-field">
            <span>
              {t('Transparencia del fondo:', 'Background transparency:')}{' '}
              {appearance.boardOpacity >= 1
                ? t('ninguna', 'none')
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
              {t('Usarlo también en las otras pestañas', 'Use it on the other tabs too')}
              <small>
                {t(
                  'Tareas, Notas, Focus, Ajustes… todas con el mismo fondo.',
                  'Tasks, Notes, Focus, Settings… all with the same background.'
                )}
              </small>
            </span>
          </label>
        </>
      )}

      <div className="settings-subsection">
        <h4>🧩 Widgets</h4>
        <div className="settings-field">
          <span>{t('Fondo de todos los widgets', 'Background for all widgets')}</span>
          <BackgroundPicker
            value={appearance.widgetBackground}
            onChange={(widgetBackground) =>
              widgetBackground && update({ appearance: { widgetBackground } })
            }
          />
          <small>
            {t(
              'Cada widget puede tener el suyo desde su ⚙︎. Con imagen, se pone un velo suave para que el texto se lea bien.',
              'Each widget can have its own from its ⚙︎. With an image, a soft veil goes on top so the text is easy to read.'
            )}
          </small>
        </div>

        <label className="settings-field">
          <span>
            {t('Transparencia:', 'Transparency:')}{' '}
            {appearance.widgetOpacity >= 1
              ? t('ninguna', 'none')
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
            {t('Esquinas', 'Corners')}:{' '}
            {appearance.widgetRadius === 0
              ? t('rectas', 'square')
              : `${appearance.widgetRadius} px`}
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
          <small>
            {t(
              'Cada widget puede tener las suyas desde su ⚙︎.',
              'Each widget can have its own from its ⚙︎.'
            )}
          </small>
        </label>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={appearance.widgetShadow}
            onChange={(e) => update({ appearance: { widgetShadow: e.target.checked } })}
          />
          <span>
            {t('Sombra en el tablero', 'Shadow on the board')}
            <small>
              {t(
                'Los widgets despegados tienen su propia opción de sombra en su ⚙︎.',
                'Popped-out widgets have their own shadow option in their ⚙︎.'
              )}
            </small>
          </span>
        </label>
      </div>
    </section>
  )
}
