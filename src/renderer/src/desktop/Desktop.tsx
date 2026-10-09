import { useMemo } from 'react'
import { getCompactor, Responsive, useContainerWidth, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Breakpoint, DesktopState, LayoutEntry } from '../../../shared/types'
import type { DesktopStore } from '../store/useDesktop'
import { getWidgetDefinition } from '../widgets/registry'
import { BREAKPOINT_KEYS, BREAKPOINTS, COLS, ROW_HEIGHT, WIDGET_GAP } from './layout'
import { WidgetFrame } from './WidgetFrame'
import './desktop.css'

// No gravity and overlap allowed: widgets stay exactly where they are dropped.
const freePlacement = getCompactor(null, true)

interface Props {
  desktop: DesktopState
  store: DesktopStore
}

export function Desktop({ desktop, store }: Props): React.JSX.Element {
  const { width, containerRef, mounted } = useContainerWidth()
  // Widget order in the store is the stacking order (last = on top). Children keep a stable
  // order so React never moves DOM nodes mid-drag; z-index does the stacking instead.
  const visible = desktop.widgets
    .map((w, stackIndex) => ({ instance: w, stackIndex }))
    .filter(({ instance }) => !instance.hidden)
    .sort((a, b) => a.instance.id.localeCompare(b.instance.id))

  // Add each widget's size limits (clamped to the breakpoint's columns) to the grid layout.
  const layouts = useMemo(() => {
    const result = {} as Record<Breakpoint, Layout>
    for (const bp of BREAKPOINT_KEYS) {
      const cols = COLS[bp]
      result[bp] = desktop.layouts[bp].map((item) => {
        const def = getWidgetDefinition(desktop.widgets.find((w) => w.id === item.i)?.type ?? '')
        const minW = Math.min(def?.minSize?.w ?? 1, cols)
        return {
          ...item,
          w: Math.min(Math.max(item.w, minW), cols),
          minW,
          minH: def?.minSize?.h,
          maxW: def?.maxSize ? Math.min(def.maxSize.w, cols) : undefined,
          maxH: def?.maxSize?.h
        }
      })
    }
    return result
  }, [desktop.layouts, desktop.widgets])

  return (
    <main className="desktop" ref={containerRef}>
      {visible.length === 0 && (
        <div className="desktop-empty">
          <p>Tu escritorio está vacío.</p>
          <p>Usa “+ Widget” para añadir uno.</p>
        </div>
      )}
      {mounted && (
        <Responsive
          width={width}
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={[0, 0]}
          containerPadding={[16 - WIDGET_GAP / 2, 8 - WIDGET_GAP / 2]}
          compactor={freePlacement}
          dragConfig={{ handle: '.widget-drag-handle', cancel: '.widget-no-drag' }}
          onLayoutChange={(_current, all) =>
            store.applyLayouts(all as Partial<Record<Breakpoint, readonly LayoutEntry[]>>)
          }
        >
          {visible.map(({ instance, stackIndex }) => {
            const def = getWidgetDefinition(instance.type)
            if (!def) return null
            return (
              <div
                key={instance.id}
                style={{ padding: WIDGET_GAP / 2, zIndex: stackIndex + 1 }}
                onPointerDownCapture={() => store.bringToFront(instance.id)}
              >
                <WidgetFrame
                  instance={instance}
                  def={def}
                  onHide={() => store.setHidden(instance.id, true)}
                  onRemove={() => store.removeWidget(instance.id)}
                  onUpdateConfig={(patch) => store.updateConfig(instance.id, patch)}
                />
              </div>
            )
          })}
        </Responsive>
      )}
    </main>
  )
}
