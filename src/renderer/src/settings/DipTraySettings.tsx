import { useEffect, useState } from 'react'
import type { DipShortcut } from '../../../shared/types'
import { DipIcon } from '../theme/DipIcon'
import type { SectionProps } from './shared'
import { IS_MAC, formatShortcut, trayName } from '../../../shared/keys'
import { t } from '../../../shared/i18n'

const shortcuts = (): Array<{ value: DipShortcut; label: string }> => [
  { value: '', label: t('Ninguno', 'None') },
  { value: 'Alt+Space', label: formatShortcut('Alt+Space') },
  { value: 'Control+Alt+Space', label: formatShortcut('Control+Alt+Space') },
  { value: 'CommandOrControl+Shift+Space', label: formatShortcut('CommandOrControl+Shift+Space') }
]

// SPEC 9.15: Dip's own menu bar icon and the shortcut that opens its mini chat.
export function DipTraySettings({ settings, update }: SectionProps): React.JSX.Element {
  const { visible, shortcut } = settings.dipTray
  const [taken, setTaken] = useState(false)

  // After choosing a shortcut, check that no other app already uses it.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      window.api.popover
        .shortcutWorks()
        .then((works) => !cancelled && setTaken(!works))
        .catch(() => undefined)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [shortcut])

  return (
    <div className="settings-subsection">
      <h4>
        <DipIcon /> {t(`Dip en la ${trayName()}`, `Dip in the ${trayName()}`)}
      </h4>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => update({ dipTray: { visible: e.target.checked } })}
        />
        <span>
          {t('Mostrar el ícono de Dip', "Show Dip's icon")}
          <small>
            {t(
              'Al hacer clic se abre un mini chat con Dip, encima de cualquier app.',
              'Click it to open a mini chat with Dip, on top of any app.'
            )}
          </small>
        </span>
      </label>
      <label className="settings-field">
        <span>
          {t('Atajo para abrirlo desde cualquier app', 'Shortcut to open it from any app')}
        </span>
        <select
          className="settings-select"
          value={shortcut}
          onChange={(e) => update({ dipTray: { shortcut: e.target.value as DipShortcut } })}
        >
          {shortcuts().map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <small>
          {taken
            ? t(
                '⚠️ Ese atajo ya lo usa otra app o el sistema. Elige otro.',
                '⚠️ Another app or the system already uses that shortcut. Pick another one.'
              )
            : shortcut === 'Alt+Space' && IS_MAC
              ? t(
                  'Ojo: con este atajo, ⌥ Espacio ya no escribe un espacio especial en otras apps.',
                  'Heads up: with this shortcut, ⌥ Space no longer types a special space in other apps.'
                )
              : shortcut === 'Alt+Space'
                ? t(
                    'Ojo: Alt+Espacio es el que abre el menú de las ventanas; con este atajo ese menú ya no sale. Mejor elige otro.',
                    "Heads up: Alt+Space opens the windows' menu; with this shortcut that menu stops working. Better pick another one."
                  )
                : t('Funciona aunque el ícono esté oculto.', 'Works even when the icon is hidden.')}
        </small>
      </label>
    </div>
  )
}
