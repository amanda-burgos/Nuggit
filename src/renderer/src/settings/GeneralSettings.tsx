import { useEffect, useState } from 'react'
import { helpContent } from '../../../shared/help'
import type { AppInfo } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import type { SectionProps } from './shared'

export function GeneralSettings({ settings, update }: SectionProps): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api.app
      .info()
      .then(setInfo)
      .catch((err) => console.error('Could not load app info', err))
  }, [])

  return (
    <section className="settings-section">
      <h3>⚙︎ General</h3>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={info?.openAtLogin ?? false}
          disabled={!info}
          onChange={(e) =>
            window.api.app
              .setOpenAtLogin(e.target.checked)
              .then(setInfo)
              .catch((err) => console.error('Could not change login item', err))
          }
        />
        <span>
          {t('Abrir Nuggit al iniciar la Mac', 'Open Nuggit when your Mac starts')}
          <small>
            {info && !info.packaged
              ? t(
                  'Mientras se está desarrollando, esto abre Electron, no la app instalada.',
                  'While in development, this opens Electron, not the installed app.'
                )
              : t(
                  'Así la barra de menú y tus widgets están listos desde que prendes la compu.',
                  'So the menu bar and your widgets are ready as soon as you turn on your computer.'
                )}
          </small>
        </span>
      </label>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={settings.onboarding.whatsNew}
          onChange={(e) => update({ onboarding: { whatsNew: e.target.checked } })}
        />
        <span>
          {t(
            'Mostrar “Qué hay de nuevo” después de cada actualización',
            'Show “What’s new” after each update'
          )}
          <small>
            {t(
              'Todas las novedades siguen en ❓ Ayuda → Novedades.',
              "Everything new is still in ❓ Help → What's new."
            )}
          </small>
        </span>
      </label>

      <fieldset className="settings-choices">
        <legend>{t('Idioma', 'Language')}</legend>
        <label>
          <input
            type="radio"
            name="language"
            checked={(settings.language ?? 'es') === 'es'}
            onChange={() => update({ language: 'es' })}
          />
          🇪🇸 Español
        </label>
        <label>
          <input
            type="radio"
            name="language"
            checked={settings.language === 'en'}
            onChange={() => update({ language: 'en' })}
          />
          🇺🇸 English
        </label>
        <small className="settings-hint">
          {t(
            'Toda la app cambia de idioma. Dip contesta en el idioma en que le hables.',
            'The whole app changes language. Dip answers in the language you talk to it in.'
          )}
        </small>
      </fieldset>

      <div className="settings-subsection">
        <h4>{t('⌨️ Atajos de teclado', '⌨️ Keyboard shortcuts')}</h4>
        <dl className="settings-shortcuts">
          {helpContent().shortcuts.map(({ keys, what }) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
