import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'

const SHORTCUTS: Array<[string, string]> = [
  ['⌘1 … ⌘9', 'Inicio, Dip, Tareas, Ahora, Tenderizer, Dailies, Notas, Brain Dump, Focus'],
  ['⌘,', 'Ajustes'],
  ['⌘N', 'Nota rápida'],
  ['Esc', 'Salir de Lockdown'],
  ['Fn Fn (🌐)', 'Dictar en cualquier campo de texto'],
  ['Enter / ⇧ Enter', 'Mandar a Dip / nueva línea']
]

export function GeneralSettings(): React.JSX.Element {
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

      <div className="settings-field">
        <span>Idioma</span>
        <small className="settings-hint">
          Nuggit está en español. Dip contesta en el idioma en que le hables (español o inglés).
        </small>
      </div>

      <div className="settings-subsection">
        <h4>⌨️ Atajos de teclado</h4>
        <dl className="settings-shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <small className="settings-hint">
          El atajo del mini chat de Dip se elige en Barra de menú.
        </small>
      </div>
    </section>
  )
}
