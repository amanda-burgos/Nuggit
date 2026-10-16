import type { PickupTrayMode } from '../../../shared/types'
import type { SectionProps } from './shared'

const OPTIONS: Array<{ value: PickupTrayMode; label: string }> = [
  { value: 'icon', label: 'Con su propio ícono' },
  { value: 'menu', label: 'Dentro del menú de Nuggit' },
  { value: 'off', label: 'Oculto' }
]

// SPEC 9.16: where the quick pickup lives in the menu bar.
export function PickupTraySettings({ settings, update }: SectionProps): React.JSX.Element {
  return (
    <div className="settings-subsection">
      <h4>🧩 Widgets rápidos (quick pickup)</h4>
      <fieldset className="settings-choices">
        <legend>
          Busca un widget y sácalo al escritorio con un clic. Desde ahí también se pone “Pin on
          top”.
        </legend>
        {OPTIONS.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name="pickup-tray"
              checked={settings.pickupTray === o.value}
              onChange={() => update({ pickupTray: o.value })}
            />
            {o.label}
          </label>
        ))}
      </fieldset>
      {settings.pickupTray === 'menu' && (
        <small>El menú de Nuggit solo aparece mientras tienes algo en curso.</small>
      )}
    </div>
  )
}
