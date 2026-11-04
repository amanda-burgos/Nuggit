import { useEffect, useState } from 'react'
import type { WidgetProps, WidgetSettingsProps } from '../types'
import './clock.css'
import { locale, t } from '../../../../shared/i18n'

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
  const time = now.toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined,
    hour12: config.hour12
  })
  const date = now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })

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
        {t('Mostrar segundos', 'Show seconds')}
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.hour12}
          onChange={(e) => updateConfig({ hour12: e.target.checked })}
        />
        {t('Formato 12 horas', '12-hour clock')}
      </label>
    </div>
  )
}
