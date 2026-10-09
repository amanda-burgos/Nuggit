import { useEffect, useState } from 'react'
import type { WidgetProps, WidgetSettingsProps } from '../types'
import './clock.css'

export interface ClockConfig {
  showSeconds: boolean
  hour12: boolean
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function ClockWidget({ config }: WidgetProps<ClockConfig>): React.JSX.Element {
  const now = useNow()
  const time = now.toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined,
    hour12: config.hour12
  })
  const date = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="clock">
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  )
}

export function ClockSettings({
  config,
  updateConfig
}: WidgetSettingsProps<ClockConfig>): React.JSX.Element {
  return (
    <div className="clock-settings">
      <label>
        <input
          type="checkbox"
          checked={config.showSeconds}
          onChange={(e) => updateConfig({ showSeconds: e.target.checked })}
        />
        Mostrar segundos
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.hour12}
          onChange={(e) => updateConfig({ hour12: e.target.checked })}
        />
        Formato 12 horas
      </label>
    </div>
  )
}
