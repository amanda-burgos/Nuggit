import { useState } from 'react'
import type { WidgetInstance } from '../../../shared/types'
import {
  WIDGET_RADIUS_MAX,
  WIDGET_RADIUS_MIN,
  WIDGET_TEXT_MAX,
  WIDGET_TEXT_MIN
} from '../../../shared/types'
import { useAIStatus } from '../store/useAIStatus'
import { backgroundVars, widgetFontVars } from '../theme/appearance'
import { useAppearance } from '../theme/appearanceContext'
import { BackgroundPicker } from '../theme/BackgroundPicker'
import { FontSelect } from '../theme/FontPicker'
import { AINotice } from './AINotice'
import type { AnyWidgetDefinition } from '../widgets/types'
import { t } from '../../../shared/i18n'

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
    if (
      window.confirm(
        t(`¿Quitar "${def.name}" del escritorio?`, `Remove "${def.name}" from the desktop?`)
      )
    )
      onRemove?.()
  }

  const lock = (): void => {
    setShowSettings(false)
    onSetLocked(true)
  }
  const setRadius = (next: number | null): void => {
    window.api.desktop
      .setRadius(instance.id, next)
      .catch((err) => console.error('Could not change corners', err))
  }
  const setTextScale = (next: number | null): void => {
    window.api.desktop
      .setTextScale(instance.id, next)
      .catch((err) => console.error('Could not change text size', err))
  }
  const generalRadius = appearance?.widgetRadius ?? 18
  const setBackground = (next: typeof instance.background | null): void => {
    window.api.desktop
      .setBackground(instance.id, next ?? null)
      .catch((err) => console.error('Could not change background', err))
  }

  return (
    <section
      className={`widget${locked ? ' is-locked' : ''}${instance.textScale ? ' has-text-scale' : ''}`}
      aria-label={def.name}
      style={
        {
          ...backgroundVars(background),
          ...(instance.radius !== undefined && { '--widget-radius': `${instance.radius}px` }),
          ...widgetFontVars(instance.font),
          ...(instance.textScale && { '--widget-text-scale': String(instance.textScale) })
        } as React.CSSProperties
      }
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
              title={t('Fijado. Clic para desfijar', 'Locked. Click to unlock')}
              onClick={() => onSetLocked(false)}
            >
              🔒
            </button>
          ) : (
            <>
              <button
                className="icon-button"
                title={t('Fijar: que no se mueva', "Lock: so it doesn't move")}
                onClick={lock}
              >
                📌
              </button>
              <button
                className={`icon-button${showSettings ? ' is-active' : ''}`}
                title={t('Ajustes del widget', 'Widget settings')}
                aria-pressed={showSettings}
                onClick={() => setShowSettings((v) => !v)}
              >
                ⚙︎
              </button>
              {onDetach && (
                <button
                  className="icon-button"
                  title={t('Despegar al escritorio', 'Pop out to the desktop')}
                  onClick={onDetach}
                >
                  ↗
                </button>
              )}
              {onAttach && (
                <button
                  className="icon-button"
                  title={t('Regresar al tablero', 'Back to the board')}
                  onClick={onAttach}
                >
                  ↙
                </button>
              )}
              {onHide && (
                <button className="icon-button" title={t('Ocultar', 'Hide')} onClick={onHide}>
                  –
                </button>
              )}
              {onRemove && (
                <button
                  className="icon-button"
                  title={t('Quitar', 'Remove')}
                  onClick={confirmRemove}
                >
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
                <span>{t('Fondo', 'Background')}</span>
                <BackgroundPicker
                  value={instance.background ?? null}
                  generalLabel={t('Usar el general', 'Use the general one')}
                  onChange={setBackground}
                />
              </div>
              <div className="widget-settings-field">
                <span>
                  {t('Esquinas', 'Corners')}: {instance.radius ?? generalRadius} px
                  {instance.radius === undefined
                    ? t(' (las generales)', ' (the general ones)')
                    : ''}
                </span>
                <div className="widget-settings-row">
                  <input
                    type="range"
                    aria-label={t('Esquinas de este widget', "This widget's corners")}
                    min={WIDGET_RADIUS_MIN}
                    max={WIDGET_RADIUS_MAX}
                    step={1}
                    value={instance.radius ?? generalRadius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                  {instance.radius !== undefined && (
                    <button
                      type="button"
                      className="bg-choice is-text"
                      onClick={() => setRadius(null)}
                    >
                      {t('Usar las generales', 'Use the general ones')}
                    </button>
                  )}
                </div>
              </div>
              <div className="widget-settings-field">
                <span>
                  {t('Letra', 'Font')}
                  {instance.font ? '' : t(' (la general)', ' (the general one)')}
                </span>
                <FontSelect
                  value={instance.font ?? null}
                  generalLabel={t('Usar la general', 'Use the general one')}
                  onChange={(font) =>
                    window.api.desktop
                      .setFont(instance.id, font)
                      .catch((err) => console.error('Could not change font', err))
                  }
                />
              </div>
              <div className="widget-settings-field">
                <span>
                  {t('Tamaño de la letra', 'Text size')}:{' '}
                  {Math.round((instance.textScale ?? 1) * 100)}%
                </span>
                <div className="widget-settings-row">
                  <input
                    type="range"
                    aria-label={t('Tamaño de la letra de este widget', "This widget's text size")}
                    min={WIDGET_TEXT_MIN}
                    max={WIDGET_TEXT_MAX}
                    step={0.05}
                    value={instance.textScale ?? 1}
                    onChange={(e) => setTextScale(Number(e.target.value))}
                  />
                  {instance.textScale !== undefined && (
                    <button
                      type="button"
                      className="bg-choice is-text"
                      onClick={() => setTextScale(null)}
                    >
                      {t('Normal', 'Normal')}
                    </button>
                  )}
                </div>
              </div>
              {onSetShadow && (
                <label>
                  <input
                    type="checkbox"
                    checked={shadow ?? false}
                    onChange={(e) => onSetShadow(e.target.checked)}
                  />
                  <span>{t('Sombra', 'Shadow')}</span>
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
                    {t('Pin on back: siempre al fondo', 'Pin on back: always at the back')}
                    <small>
                      {t(
                        'Se queda detrás de todo, como parte del fondo de pantalla. Ahí ya no recibe clics: para quitarlo, usa los widgets rápidos 🧩 de la barra de menú.',
                        "It stays behind everything, as part of the wallpaper. There it doesn't get clicks: to remove it, use the quick widgets 🧩 in the menu bar."
                      )}
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
          title={t('Cambiar tamaño', 'Resize')}
          aria-hidden
          onPointerDown={onResizePointerDown}
        />
      )}
    </section>
  )
}
