import { useState } from 'react'
import type { WidgetInstance } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

interface Props {
  instance: WidgetInstance
  def: AnyWidgetDefinition
  onHide(): void
  onRemove(): void
  onUpdateConfig(patch: Record<string, unknown>): void
}

// Common shell for every widget: header (drag handle + actions) and body.
export function WidgetFrame({
  instance,
  def,
  onHide,
  onRemove,
  onUpdateConfig
}: Props): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const config = { ...def.defaultConfig, ...(instance.config as object) }
  const Widget = def.component
  const Settings = def.settingsComponent

  const confirmRemove = (): void => {
    if (window.confirm(`¿Quitar "${def.name}" del escritorio?`)) onRemove()
  }

  return (
    <section className="widget" aria-label={def.name}>
      <header className="widget-header widget-drag-handle">
        <span className="widget-icon" aria-hidden>
          {def.icon}
        </span>
        <span className="widget-title">{def.name}</span>
        <div className="widget-actions widget-no-drag">
          {Settings && (
            <button
              className={`icon-button${showSettings ? ' is-active' : ''}`}
              title="Ajustes del widget"
              aria-pressed={showSettings}
              onClick={() => setShowSettings((v) => !v)}
            >
              ⚙︎
            </button>
          )}
          <button className="icon-button" title="Ocultar" onClick={onHide}>
            –
          </button>
          <button className="icon-button" title="Quitar" onClick={confirmRemove}>
            ×
          </button>
        </div>
      </header>
      <div className="widget-body widget-no-drag">
        {showSettings && Settings ? (
          <Settings config={config} updateConfig={onUpdateConfig} />
        ) : (
          <Widget instanceId={instance.id} config={config} updateConfig={onUpdateConfig} />
        )}
      </div>
    </section>
  )
}
