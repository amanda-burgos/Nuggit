import { useLayoutEffect, useRef, useState } from 'react'
import type { DesktopState, WidgetRect } from '../../../shared/types'
import type { DesktopStore } from '../store/useDesktop'
import { getWidgetDefinition } from '../widgets/registry'
import type { AnyWidgetDefinition } from '../widgets/types'
import { fitRect, moveRect, resizeRect, type Size } from './layout'
import { WidgetFrame } from './WidgetFrame'
import './desktop.css'
import { t } from '../../../shared/i18n'

// Pixels the pointer must travel before a press becomes a drag (so clicks stay clicks).
const DRAG_THRESHOLD = 3

type GestureMode = 'move' | 'resize'

interface Props {
  desktop: DesktopState
  store: DesktopStore
}

// The board always fills the window below the toolbar: it never grows or scrolls.
export function Desktop({ desktop, store }: Props): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState<Size | null>(null)
  const [live, setLive] = useState<{ id: string; rect: WidgetRect } | null>(null)
  const { setBoardSize } = store

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const size = {
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      }
      setArea(size)
      setBoardSize(size)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [setBoardSize])

  const startGesture = (
    e: React.PointerEvent,
    id: string,
    mode: GestureMode,
    start: WidgetRect,
    def: AnyWidgetDefinition
  ): void => {
    if (e.button !== 0 || !area) return
    if (mode === 'move' && (e.target as HTMLElement).closest('.widget-no-drag')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let current = start
    let started = false

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!started && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      started = true
      current =
        mode === 'move' ? moveRect(start, dx, dy, area) : resizeRect(start, dx, dy, area, def)
      setLive({ id, rect: current })
    }
    const onEnd = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      setLive(null)
      if (!started) return
      if (mode === 'move') store.moveWidget(id, current.x, current.y)
      else store.resizeWidget(id, current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  const visible = desktop.widgets
    .map((instance, stackIndex) => ({ instance, stackIndex }))
    .filter(
      ({ instance }) =>
        !instance.hidden && !desktop.detached[instance.id] && desktop.positions[instance.id]
    )
    // Stable DOM order so nodes never move mid-drag; z-index does the stacking.
    .sort((a, b) => a.instance.id.localeCompare(b.instance.id))

  return (
    <main className={`board${live ? ' is-interacting' : ''}`}>
      <div className="board-area" ref={areaRef}>
        {visible.length === 0 && (
          <div className="desktop-empty">
            <p>{t('Tu escritorio está vacío.', 'Your desktop is empty.')}</p>
            <p>{t('Usa “+ Widget” para añadir uno.', 'Use “+ Widget” to add one.')}</p>
          </div>
        )}
        {area &&
          visible.map(({ instance, stackIndex }) => {
            const def = getWidgetDefinition(instance.type)
            if (!def) return null
            const rect =
              live?.id === instance.id
                ? live.rect
                : fitRect(desktop.positions[instance.id], area, def)
            return (
              <div
                key={instance.id}
                className={`board-item${live?.id === instance.id ? ' is-active' : ''}`}
                style={{
                  transform: `translate(${rect.x}px, ${rect.y}px)`,
                  width: rect.w,
                  height: rect.h,
                  zIndex: stackIndex + 1
                }}
                onPointerDownCapture={() => store.bringToFront(instance.id)}
              >
                <WidgetFrame
                  instance={instance}
                  def={def}
                  onHeaderPointerDown={(e) => startGesture(e, instance.id, 'move', rect, def)}
                  onResizePointerDown={(e) => startGesture(e, instance.id, 'resize', rect, def)}
                  onDetach={() => {
                    const origin = areaRef.current?.getBoundingClientRect()
                    if (!origin) return
                    store.detachWidget(instance.id, {
                      ...rect,
                      x: origin.left + rect.x,
                      y: origin.top + rect.y
                    })
                  }}
                  locked={instance.locked ?? false}
                  onSetLocked={(locked) =>
                    window.api.desktop
                      .setLocked(instance.id, locked)
                      .catch((err) => console.error('Could not fix widget', err))
                  }
                  onHide={() => store.setHidden(instance.id, true)}
                  onRemove={() => store.removeWidget(instance.id)}
                  onUpdateConfig={(patch) => store.updateConfig(instance.id, patch)}
                />
              </div>
            )
          })}
      </div>
    </main>
  )
}
