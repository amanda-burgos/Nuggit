import { useEffect, useState } from 'react'
import { HELP } from '../../../shared/help'
import type { AppInfo } from '../../../shared/types'
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
          Abrir Nuggit al iniciar la Mac
          <small>
            {info && !info.packaged
              ? 'Mientras se está desarrollando, esto abre Electron, no la app instalada.'
              : 'Así la barra de menú y tus widgets están listos desde que prendes la compu.'}
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
          Mostrar “Qué hay de nuevo” después de cada actualización
          <small>Todas las novedades siguen en ❓ Ayuda → Novedades.</small>
        </span>
      </label>

      <div className="settings-field">
        <span>Idioma</span>
        <small className="settings-hint">
          Nuggit está en español. Dip contesta en el idioma en que le hables (español o inglés).
        </small>
      </div>

      <div className="settings-subsection">
        <h4>⌨️ Atajos de teclado</h4>
        <dl className="settings-shortcuts">
          {HELP.shortcuts.map(({ keys, what }) => (
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
