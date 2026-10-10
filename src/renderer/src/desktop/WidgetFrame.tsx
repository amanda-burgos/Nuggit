import { useState } from 'react'
import type { WidgetInstance } from '../../../shared/types'
import type { AnyWidgetDefinition } from '../widgets/types'

// Actions are shown only when their handler is given: the board and a detached
// window offer different ones.
interface Props {
  instance: WidgetInstance
  def: AnyWidgetDefinition
  onHeaderPointerDown?(e: React.PointerEvent): void
  onResizePointerDown?(e: React.PointerEvent): void
  onDetach?(): void
  onAttach?(): void
  alwaysOnTop?: boolean
  onToggleAlwaysOnTop?(): void
  onHide?(): void
  onRemove?(): void
  onUpdateConfig(patch: Record<string, unknown>): void
}

// Common shell for every widget: header (drag handle + actions), body and resize corner.
export function WidgetFrame({
  instance,
  def,
  onHeaderPointerDown,
  onResizePointerDown,
  onDetach,
  onAttach,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onHide,
  onRemove,
  onUpdateConfig
}: Props): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const config = { ...def.defaultConfig, ...(instance.config as object) }
  const Widget = def.component
  const Settings = def.settingsComponent

  const confirmRemove = (): void => {
    if (window.confirm(`¿Quitar "${def.name}" del escritorio?`)) onRemove?.()
  }

  return (
    <section className="widget" aria-label={def.name}>
      <header className="widget-header" onPointerDown={onHeaderPointerDown}>
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
          {onToggleAlwaysOnTop && (
            <button
              className={`icon-button${alwaysOnTop ? ' is-active' : ''}`}
              title={alwaysOnTop ? 'Mantener encima: sí' : 'Mantener encima: no'}
              aria-pressed={alwaysOnTop}
              onClick={onToggleAlwaysOnTop}
            >
              <span className={`pin${alwaysOnTop ? ' is-on' : ''}`}>📌</span>
            </button>
          )}
          {onDetach && (
            <button className="icon-button" title="Despegar al escritorio" onClick={onDetach}>
              ↗
            </button>
          )}
          {onAttach && (
            <button className="icon-button" title="Regresar al tablero" onClick={onAttach}>
              ↙
            </button>
          )}
          {onHide && (
            <button className="icon-button" title="Ocultar" onClick={onHide}>
              –
            </button>
          )}
          {onRemove && (
            <button className="icon-button" title="Quitar" onClick={confirmRemove}>
              ×
            </button>
          )}
        </div>
      </header>
      <div className="widget-body widget-no-drag">
        {showSettings && Settings ? (
          <Settings config={config} updateConfig={onUpdateConfig} />
        ) : (
          <Widget instanceId={instance.id} config={config} updateConfig={onUpdateConfig} />
        )}
      </div>
      {onResizePointerDown && (
        <div
          className="widget-resize-handle"
          title="Cambiar tamaño"
          aria-hidden
          onPointerDown={onResizePointerDown}
        />
      )}
    </section>
  )
}
