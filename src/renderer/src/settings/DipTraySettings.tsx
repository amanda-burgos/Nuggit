import { useEffect, useState } from 'react'
import type { DipShortcut } from '../../../shared/types'
import type { SectionProps } from './shared'

const SHORTCUTS: Array<{ value: DipShortcut; label: string }> = [
  { value: '', label: 'Ninguno' },
  { value: 'Alt+Space', label: '⌥ Espacio' },
  { value: 'Control+Alt+Space', label: '⌃ ⌥ Espacio' },
  { value: 'Command+Shift+Space', label: '⌘ ⇧ Espacio' }
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
      <h4>🫙 Dip en la barra de menú</h4>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => update({ dipTray: { visible: e.target.checked } })}
        />
        <span>
          Mostrar el ícono de Dip
          <small>Al hacer clic se abre un mini chat con Dip, encima de cualquier app.</small>
        </span>
      </label>
      <label className="settings-field">
        <span>Atajo para abrirlo desde cualquier app</span>
        <select
          className="settings-select"
          value={shortcut}
          onChange={(e) => update({ dipTray: { shortcut: e.target.value as DipShortcut } })}
        >
          {SHORTCUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <small>
          {taken
            ? '⚠️ Ese atajo ya lo usa otra app o el sistema. Elige otro.'
            : shortcut === 'Alt+Space'
              ? 'Ojo: con este atajo, ⌥ Espacio ya no escribe un espacio especial en otras apps.'
              : 'Funciona aunque el ícono esté oculto.'}
        </small>
      </label>
    </div>
  )
}
