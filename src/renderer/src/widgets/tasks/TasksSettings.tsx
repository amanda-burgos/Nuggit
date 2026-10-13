import type { StatusIndicator } from '../../../../shared/types'
import { useSettings } from '../../store/useSettings'

const OPTIONS: Array<{ value: StatusIndicator; label: string }> = [
  { value: 'dot', label: 'Solo el puntito' },
  { value: 'dot-title', label: 'Puntito y nombre de la tarea' },
  { value: 'title', label: 'Solo el nombre de la tarea' },
  { value: 'off', label: 'Nada' }
]

// The menu bar indicator is an app setting (not per widget), shown here because it is
// about tasks in progress.
export function TasksSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const current = settings?.statusIndicator ?? 'dot'

  return (
    <fieldset className="tasks-settings">
      <legend>Cuando hay algo en curso, mostrar en la barra de menú</legend>
      {OPTIONS.map((option) => (
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
