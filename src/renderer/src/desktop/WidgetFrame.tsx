import { useState } from 'react'
import type { WidgetInstance } from '../../../shared/types'
import { useAIStatus } from '../store/useAIStatus'
import { backgroundVars } from '../theme/appearance'
import { useAppearance } from '../theme/appearanceContext'
import { BackgroundPicker } from '../theme/BackgroundPicker'
import { AINotice } from './AINotice'
import type { AnyWidgetDefinition } from '../widgets/types'

// Actions are shown only when their handler is given: the board and a detached
// window offer different ones.
interface Props {
  instance: WidgetInstance
  def: AnyWidgetDefinition
  showTitle?: boolean // icon + name in the header
  onHeaderPointerDown?(e: React.PointerEvent): void
  onResizePointerDown?(e: React.PointerEvent): void
  onDetach?(): void
  onAttach?(): void
  // "Fijar" (the 📌 button): no moving, no resizing, no edit controls; only a small lock
  // to undo it.
  locked: boolean
  onSetLocked(locked: boolean): void
  // Detached windows only: the macOS window shadow, and "Pin on back".
  shadow?: boolean
  onSetShadow?(shadow: boolean): void
  pinBack?: boolean
  onSetPinBack?(pinBack: boolean): void
  onHide?(): void
  onRemove?(): void
  onUpdateConfig(patch: Record<string, unknown>): void
}

// Common shell for every widget: header (drag handle + actions), body and resize corner.
export function WidgetFrame({
  instance,
  def,
  showTitle = true,
  onHeaderPointerDown,
  onResizePointerDown,
  onDetach,
  onAttach,
  locked,
  onSetLocked,
  shadow,
  onSetShadow,
  pinBack,
  onSetPinBack,
  onHide,
  onRemove,
  onUpdateConfig
}: Props): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const aiStatus = useAIStatus()
  const appearance = useAppearance()
  // Its own background if it has one, otherwise the general one (Fase 9).
  const background = instance.background ?? appearance?.widgetBackground ?? { kind: 'default' }
  // Widgets that need AI show a friendly notice instead while no AI is available.
  const missingAI = def.needsAI && aiStatus !== null && aiStatus.active === null
  const config = { ...def.defaultConfig, ...(instance.config as object) }
  const Widget = def.component
  const Settings = def.settingsComponent

  const confirmRemove = (): void => {
    if (window.confirm(`¿Quitar "${def.name}" del escritorio?`)) onRemove?.()
  }

  const lock = (): void => {
    setShowSettings(false)
    onSetLocked(true)
  }
  const setBackground = (next: typeof instance.background | null): void => {
    window.api.desktop
      .setBackground(instance.id, next ?? null)
      .catch((err) => console.error('Could not change background', err))
  }

  return (
    <section
      className={`widget${locked ? ' is-locked' : ''}`}
      aria-label={def.name}
      style={backgroundVars(background) as React.CSSProperties}
    >
      <header className="widget-header" onPointerDown={locked ? undefined : onHeaderPointerDown}>
        {showTitle && (
          <>
            <span className="widget-icon" aria-hidden>
              {def.icon}
            </span>
            <span className="widget-title">{def.name}</span>
          </>
        )}
        <div className="widget-actions widget-no-drag">
          {locked ? (
            <button
              className="icon-button widget-lock"
              title="Fijado. Clic para desfijar"
              onClick={() => onSetLocked(false)}
            >
              🔒
            </button>
          ) : (
            <>
              <button className="icon-button" title="Fijar: que no se mueva" onClick={lock}>
                📌
              </button>
              <button
                className={`icon-button${showSettings ? ' is-active' : ''}`}
                title="Ajustes del widget"
                aria-pressed={showSettings}
                onClick={() => setShowSettings((v) => !v)}
              >
                ⚙︎
              </button>
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
            </>
          )}
        </div>
      </header>
      <div className="widget-body widget-no-drag">
        {showSettings && !locked ? (
          <div className="widget-settings">
            {/* Top: the same general options for every widget (SPEC 9.16). */}
            <div className="widget-settings-general">
              <div className="widget-settings-field">
                <span>Fondo</span>
                <BackgroundPicker
                  value={instance.background ?? null}
                  generalLabel="Usar el general"
                  onChange={setBackground}
                />
              </div>
              {onSetShadow && (
                <label>
                  <input
                    type="checkbox"
                    checked={shadow ?? false}
                    onChange={(e) => onSetShadow(e.target.checked)}
                  />
                  <span>Sombra</span>
                </label>
              )}
              {onSetPinBack && (
                <label>
                  <input
                    type="checkbox"
                    checked={pinBack ?? false}
                    onChange={(e) => onSetPinBack(e.target.checked)}
                  />
                  <span>
                    Pin on back: siempre al fondo
                    <small>
                      Se queda detrás de todo, como parte del fondo de pantalla. Ahí ya no recibe
                      clics: para quitarlo, usa los widgets rápidos 🧩 de la barra de menú.
                    </small>
                  </span>
                </label>
              )}
            </div>
            {/* Bottom: this widget's own options, if it has any. */}
            {Settings && (
              <div className="widget-settings-own has-divider">
                <Settings config={config} updateConfig={onUpdateConfig} />
              </div>
            )}
          </div>
        ) : missingAI ? (
          <AINotice />
        ) : (
          <Widget
            instanceId={instance.id}
            size="widget"
            config={config}
            updateConfig={onUpdateConfig}
          />
        )}
      </div>
      {onResizePointerDown && !locked && (
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
