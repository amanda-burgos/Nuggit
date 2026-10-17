import { useEffect, useRef, useState } from 'react'
import type { SavedDesktop, WidgetInstance } from '../../../shared/types'
import { useSettings } from '../store/useSettings'
import { getWidgetDefinition, widgetRegistry } from '../widgets/registry'
import type { AnyWidgetDefinition } from '../widgets/types'
import '../popover/popover.css'
import './pickup.css'

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
        <button className="icon-button" title="Cerrar (Esc)" onClick={close}>
          ×
        </button>
      </header>
      <div className="popover-body pickup-body">
        <input
          ref={searchRef}
          className="pickup-search"
          type="search"
          placeholder="Buscar un widget…"
          aria-label="Buscar un widget"
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
              <h3>Abiertos</h3>
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
              <h3>Añadir al escritorio</h3>
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
            <p className="pickup-empty">No hay ningún widget que se llame así.</p>
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
  const where = entry ? 'En el escritorio' : instance.hidden ? 'Oculto' : 'En el tablero'
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
          title={pinBack ? 'Editar (lo sube un momento)' : 'Traer al frente'}
          onClick={() => window.api.widgetWindows.focus(instance.id).catch(report)}
        >
          <span className="pickup-icon" aria-hidden>
            {def.icon}
          </span>
          <span className="pickup-name">
            {def.name}
            <small>
              {where}
              {onTop && (allSpaces ? ' · Al frente, en todos los escritorios' : ' · Al frente')}
              {pinBack && ' · Al fondo'}
              {instance.locked && ' · 🔒'}
            </small>
          </span>
        </button>
        <button
          className={`icon-button${showSettings ? ' is-active' : ''}`}
          title="Más opciones"
          aria-pressed={showSettings}
          onClick={onToggleSettings}
        >
          ⚙︎
        </button>
        {!instance.hidden && (
          <button
            className="icon-button"
            title={entry ? 'Cerrar (vuelve al tablero de Nuggit)' : 'Cerrar (lo oculta)'}
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
              title="Lo sube un momento para moverlo o cambiarlo; al terminar vuelve al fondo"
              onClick={() => window.api.widgetWindows.editBack(instance.id).catch(report)}
            >
              ✏️ Editar
            </button>
            <button className="pickup-action" onClick={() => setOptions({ pinBack: false })}>
              Quitar del fondo
            </button>
          </>
        ) : (
          <button
            className={`pickup-action${onTop ? ' is-on' : ''}`}
            aria-pressed={onTop}
            title={
              onTop
                ? 'Quitar: deja de estar siempre al frente'
                : entry
                  ? 'Siempre encima de las demás ventanas, en todos los escritorios'
                  : 'Lo saca al escritorio y lo deja siempre encima, en todos los escritorios'
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
              En todos los escritorios
              <small>
                Con Pin on top: sigue ahí al cambiar de escritorio y encima de apps en pantalla
                completa.
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
              Pin on back: siempre al fondo
              <small>
                Detrás de todas las ventanas y de los archivos del Escritorio. Ahí no recibe clics:
                usa ✏️ Editar para moverlo o cambiarlo.
              </small>
            </span>
          </label>
        </div>
      )}
    </li>
  )
}
