import { useEffect, useRef, useState } from 'react'
import type { DetachedWidget, WidgetInstance } from '../../../shared/types'
import { getWidgetDefinition, widgetRegistry } from '../widgets/registry'

interface Props {
  widgets: WidgetInstance[]
  detached: Record<string, DetachedWidget>
  onAdd(type: string): void
  onShow(id: string): void
  onAttach(id: string): void
  onRemoveAll(): void
}

export function Toolbar({
  widgets,
  detached,
  onAdd,
  onShow,
  onAttach,
  onRemoveAll
}: Props): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hidden = widgets.filter((w) => w.hidden && !detached[w.id])
  const outside = widgets.filter((w) => detached[w.id])

  // Close the menu on outside click or Esc.
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="toolbar">
      <h1 className="toolbar-title">
        <span aria-hidden>🏠</span> Inicio
      </h1>
      <div className="toolbar-actions">
        <div className="menu-anchor" ref={menuRef}>
          <button
            className="button-primary"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            + Widget
            {hidden.length > 0 && <span className="badge">{hidden.length}</span>}
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <div className="menu-label">Añadir</div>
              {widgetRegistry.map((def) => (
                <button
                  key={def.type}
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    onAdd(def.type)
                    setMenuOpen(false)
                  }}
                >
                  <span aria-hidden>{def.icon}</span> {def.name}
                </button>
              ))}
              {hidden.length > 0 && (
                <>
                  <div className="menu-label">Ocultos</div>
                  {hidden.map((w) => {
                    const def = getWidgetDefinition(w.type)
                    return (
                      <button
                        key={w.id}
                        role="menuitem"
                        className="menu-item"
                        onClick={() => {
                          onShow(w.id)
                          setMenuOpen(false)
                        }}
                      >
                        <span aria-hidden>{def?.icon}</span> Mostrar {def?.name}
                      </button>
                    )
                  })}
                </>
              )}
              {outside.length > 0 && (
                <>
                  <div className="menu-label">En tu escritorio</div>
                  {outside.map((w) => {
                    const def = getWidgetDefinition(w.type)
                    return (
                      <button
                        key={w.id}
                        role="menuitem"
                        className="menu-item"
                        onClick={() => {
                          onAttach(w.id)
                          setMenuOpen(false)
                        }}
                      >
                        <span aria-hidden>{def?.icon}</span> Regresar {def?.name}
                      </button>
                    )
                  })}
                </>
              )}
              {widgets.length > 0 && (
                <>
                  <div className="menu-separator" />
                  <button
                    role="menuitem"
                    className="menu-item menu-item-danger"
                    onClick={() => {
                      setMenuOpen(false)
                      const count = widgets.length
                      const message =
                        count === 1 ? '¿Quitar el widget?' : `¿Quitar los ${count} widgets?`
                      if (window.confirm(message)) onRemoveAll()
                    }}
                  >
                    <span aria-hidden>🗑️</span> Quitar todos
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
