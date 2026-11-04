import { t } from '../../../../shared/i18n'
import type { StatusIndicator } from '../../../../shared/types'
import { trayName } from '../../../../shared/keys'
import { useSettings } from '../../store/useSettings'

const options = (): Array<{ value: StatusIndicator; label: string }> => [
  { value: 'dot', label: t('Solo el puntito', 'Just the dot') },
  { value: 'dot-title', label: t('Puntito y nombre de la tarea', 'Dot and task name') },
  { value: 'title', label: t('Solo el nombre de la tarea', 'Just the task name') },
  { value: 'off', label: t('Nada', 'Nothing') }
]

// The menu bar indicator is an app setting (not per widget), shown here because it is
// about tasks in progress.
export function TasksSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const current = settings?.statusIndicator ?? 'dot'

  return (
    <fieldset className="tasks-settings">
      <legend>
        {t(
          `Cuando hay algo en curso, mostrar en la ${trayName()}`,
          `When something is in progress, show in the ${trayName()}`
        )}
      </legend>
      {options().map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name="status-indicator"
            checked={current === option.value}
            disabled={!settings}
            onChange={() => update({ statusIndicator: option.value })}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
