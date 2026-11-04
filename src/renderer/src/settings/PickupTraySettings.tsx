import type { PickupTrayMode } from '../../../shared/types'
import type { SectionProps } from './shared'
import { t } from '../../../shared/i18n'

const options = (): Array<{ value: PickupTrayMode; label: string }> => [
  { value: 'icon', label: t('Con su propio ícono', 'With its own icon') },
  { value: 'menu', label: t('Dentro del menú de Nuggit', "Inside Nuggit's menu") },
  { value: 'off', label: t('Oculto', 'Hidden') }
]

// SPEC 9.16: where the quick pickup lives in the menu bar.
export function PickupTraySettings({ settings, update }: SectionProps): React.JSX.Element {
  return (
    <div className="settings-subsection">
      <h4>🧩 {t('Widgets rápidos (quick pickup)', 'Quick widgets (quick pickup)')}</h4>
      <fieldset className="settings-choices">
        <legend>
          {t(
            'Busca un widget y sácalo al escritorio con un clic. Desde ahí también se pone “Pin on top”.',
            'Find a widget and pop it out onto your desktop in one click. You can also turn on “Pin on top” from there.'
          )}
        </legend>
        {options().map((o) => (
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
        <small>
          {t(
            'El menú de Nuggit solo aparece mientras tienes algo en curso.',
            "Nuggit's menu only shows up while you have something in progress."
          )}
        </small>
      )}
    </div>
  )
}
