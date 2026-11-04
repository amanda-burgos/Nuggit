import { useEffect, useRef, useState } from 'react'
import type { SavedDesktop, WidgetInstance } from '../../../shared/types'
import { useSettings } from '../store/useSettings'
import { getWidgetDefinition, widgetRegistry } from '../widgets/registry'
import type { AnyWidgetDefinition } from '../widgets/types'
import '../popover/popover.css'
import './pickup.css'
import { t } from '../../../shared/i18n'

const close = (): void => window.api.popover.hide()
const report = (err: unknown): void => console.error('Quick pickup', err)

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// SPEC 9.16: the quick pickup, opened from its menu bar icon. A search box, the widgets
// already open (bring to front, close, "Pin on top") and the ones that can be added, which
// appear detached on the desktop right away.
export function QuickPickup(): React.JSX.Element {
  useSettings() // follows the app's theme
  const [desktop, setDesktop] = useState<SavedDesktop | null>(null)
  const [query, setQuery] = useState('')
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Widgets'
    const unsubscribe = window.api.desktop.onChange(setDesktop)
    window.api.desktop
      .load()
      .then((saved) => setDesktop((prev) => prev ?? saved))
      .catch(report)
    // Every time it opens: a fresh search, ready to type.
    const onFocus = (): void => {
      setQuery('')
      setSettingsFor(null)
      searchRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('keydown', onKey)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const matches = (def: AnyWidgetDefinition): boolean =>
    !query.trim() || normalize(def.name).includes(normalize(query.trim()))

  const open = (desktop?.widgets ?? [])
    .map((instance) => ({ instance, def: getWidgetDefinition(instance.type) }))
    .filter((w): w is { instance: WidgetInstance; def: AnyWidgetDefinition } =>
      Boolean(w.def && matches(w.def))
    )
    .reverse() // most recent first
  const addable = widgetRegistry.filter(matches)

  const add = (def: AnyWidgetDefinition): void => {
    window.api.widgetWindows
      .open({ type: def.type, config: structuredClone(def.defaultConfig), size: def.defaultSize })
      .catch(report)
  }

  // Enter in the search box: the first match (an open widget comes to the front).
  const pickFirst = (): void => {
    if (open[0]) window.api.widgetWindows.focus(open[0].instance.id).catch(report)
    else if (addable[0]) add(addable[0])
  }

  return (
    <div className="popover pickup">
      <header className="popover-header">
        <span className="popover-title">
          <span aria-hidden>🧩</span> Widgets
        </span>
        <button className="icon-button" title={t('Cerrar (Esc)', 'Close (Esc)')} onClick={close}>
          ×
        </button>
      </header>
      <div className="popover-body pickup-body">
        <input
          ref={searchRef}
          className="pickup-search"
          type="search"
          placeholder={t('Buscar un widget…', 'Search for a widget…')}
          aria-label={t('Buscar un widget', 'Search for a widget')}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') pickFirst()
          }}
        />

        <div className="pickup-lists">
          {open.length > 0 && (
            <section>
              <h3>{t('Abiertos', 'Open')}</h3>
              <ul>
                {open.map(({ instance, def }) => (
                  <OpenItem
                    key={instance.id}
                    instance={instance}
                    def={def}
                    desktop={desktop!}
                    showSettings={settingsFor === instance.id}
                    onToggleSettings={() =>
                      setSettingsFor((id) => (id === instance.id ? null : instance.id))
                    }
                  />
                ))}
              </ul>
            </section>
          )}

          {addable.length > 0 && (
            <section>
              <h3>{t('Añadir al escritorio', 'Add to the desktop')}</h3>
              <ul>
                {addable.map((def) => (
                  <li key={def.type}>
                    <button className="pickup-row" onClick={() => add(def)}>
                      <span className="pickup-icon" aria-hidden>
                        {def.icon}
                      </span>
                      <span className="pickup-name">{def.name}</span>
                      <span className="pickup-hint">＋</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {open.length === 0 && addable.length === 0 && (
            <p className="pickup-empty">
              {t('No hay ningún widget que se llame así.', "There's no widget with that name.")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function OpenItem({
  instance,
  def,
  desktop,
  showSettings,
  onToggleSettings
}: {
  instance: WidgetInstance
  def: AnyWidgetDefinition
  desktop: SavedDesktop
  showSettings: boolean
  onToggleSettings(): void
}): React.JSX.Element {
  const entry = desktop.detached?.[instance.id]
  const where = entry
    ? t('En el escritorio', 'On the desktop')
    : instance.hidden
      ? t('Oculto', 'Hidden')
      : t('En el tablero', 'On the board')
  const onTop = entry?.alwaysOnTop ?? false
  const allSpaces = entry?.allSpaces ?? true // on every desktop unless turned off
  const pinBack = entry?.pinBack ?? false
  const setOptions = (options: {
    alwaysOnTop?: boolean
    allSpaces?: boolean
    pinBack?: boolean
  }): void => {
    window.api.widgetWindows.setOptions(instance.id, options).catch(report)
  }

  return (
    <li className={`pickup-open${showSettings ? ' is-open' : ''}`}>
      <div className="pickup-row is-open-widget">
        <button
          className="pickup-main"
          title={
            pinBack
              ? t('Editar (lo sube un momento)', 'Edit (brings it up for a moment)')
              : t('Traer al frente', 'Bring to front')
          }
          onClick={() => window.api.widgetWindows.focus(instance.id).catch(report)}
        >
          <span className="pickup-icon" aria-hidden>
            {def.icon}
          </span>
          <span className="pickup-name">
            {def.name}
            <small>
              {where}
              {onTop &&
                (allSpaces
                  ? t(' · Al frente, en todos los escritorios', ' · On top, on every desktop')
                  : t(' · Al frente', ' · On top'))}
              {pinBack && t(' · Al fondo', ' · At the back')}
              {instance.locked && ' · 🔒'}
            </small>
          </span>
        </button>
        <button
          className={`icon-button${showSettings ? ' is-active' : ''}`}
          title={t('Más opciones', 'More options')}
          aria-pressed={showSettings}
          onClick={onToggleSettings}
        >
          ⚙︎
        </button>
        {!instance.hidden && (
          <button
            className="icon-button"
            title={
              entry
                ? t('Cerrar (vuelve al tablero de Nuggit)', "Close (goes back to Nuggit's board)")
                : t('Cerrar (lo oculta)', 'Close (hides it)')
            }
            onClick={() => window.api.widgetWindows.close(instance.id).catch(report)}
          >
            ×
          </button>
        )}
      </div>

      <div className="pickup-actions">
        {pinBack ? (
          <>
            {/* At the back it takes no clicks: these are the way to reach it. */}
            <button
              className="pickup-action"
              title={t(
                'Lo sube un momento para moverlo o cambiarlo; al terminar vuelve al fondo',
                'Brings it up for a moment to move or change it; when done it goes back'
              )}
              onClick={() => window.api.widgetWindows.editBack(instance.id).catch(report)}
            >
              {t('✏️ Editar', '✏️ Edit')}
            </button>
            <button className="pickup-action" onClick={() => setOptions({ pinBack: false })}>
              {t('Quitar del fondo', 'Take off the back')}
            </button>
          </>
        ) : (
          <button
            className={`pickup-action${onTop ? ' is-on' : ''}`}
            aria-pressed={onTop}
            title={
              onTop
                ? t('Quitar: deja de estar siempre al frente', 'Remove: stops always being on top')
                : entry
                  ? t(
                      'Siempre encima de las demás ventanas, en todos los escritorios',
                      'Always above other windows, on every desktop'
                    )
                  : t(
                      'Lo saca al escritorio y lo deja siempre encima, en todos los escritorios',
                      'Pops it out to the desktop and keeps it on top, on every desktop'
                    )
            }
            onClick={() => setOptions({ alwaysOnTop: !onTop })}
          >
            📌 Pin on top{onTop ? ' ✓' : ''}
          </button>
        )}
      </div>

      {showSettings && (
        <div className="pickup-settings">
          <label className={onTop ? '' : 'is-disabled'}>
            <input
              type="checkbox"
              checked={onTop && allSpaces}
              disabled={!onTop}
              onChange={(e) => setOptions({ allSpaces: e.target.checked })}
            />
            <span>
              {t('En todos los escritorios', 'On every desktop')}
              <small>
                {t(
                  'Con Pin on top: sigue ahí al cambiar de escritorio y encima de apps en pantalla completa.',
                  'With Pin on top: stays there when you switch desktops and above full-screen apps.'
                )}
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={pinBack}
              onChange={(e) => setOptions({ pinBack: e.target.checked })}
            />
            <span>
              {t('Pin on back: siempre al fondo', 'Pin on back: always at the back')}
              <small>
                {t(
                  'Detrás de todas las ventanas y de los archivos del Escritorio. Ahí no recibe clics: usa ✏️ Editar para moverlo o cambiarlo.',
                  "Behind every window and the files on your Desktop. There it doesn't get clicks: use ✏️ Edit to move or change it."
                )}
              </small>
            </span>
          </label>
        </div>
      )}
    </li>
  )
}
