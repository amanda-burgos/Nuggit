import { useEffect, useState } from 'react'
import type { DetachedWindowOptions, SavedDesktop } from '../../../shared/types'
import { getWidgetDefinition } from '../widgets/registry'
import { WidgetFrame } from './WidgetFrame'
import './desktop.css'
import { t } from '../../../shared/i18n'

interface Props {
  id: string
}

// One widget in its own window on the computer's desktop. The window itself is moved by
// its header and resized from its edges (unless it is fixed); changes go through the main
// process. "Pin on top" is set from the quick pickup only (SPEC 9.16).
export function DetachedWidget({ id }: Props): React.JSX.Element {
  const [desktop, setDesktop] = useState<SavedDesktop | null>(null)
  const instance = desktop?.widgets.find((w) => w.id === id)
  const def = instance ? getWidgetDefinition(instance.type) : undefined
  const entry = desktop?.detached?.[id]

  useEffect(() => {
    const unsubscribe = window.api.desktop.onChange(setDesktop)
    window.api.desktop
      .load()
      .then((saved) => saved && setDesktop(saved))
      .catch((err) => console.error('Could not load desktop', err))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (def) window.api.widgetWindows.setSizeLimits(def.minSize, def.maxSize)
  }, [def])

  useEffect(() => {
    if (def) document.title = `${def.name} · Nuggit`
  }, [def])

  if (!instance || !def) return <div className="detached" />

  const report = (err: unknown): void => console.error('Could not update widget', err)
  const setOptions = (options: DetachedWindowOptions): void => {
    window.api.widgetWindows.setOptions(id, options).catch(report)
  }

  // Opened with "Editar" from the quick pickup while it is "Pin on back".
  const editingBack = entry?.pinBack && new URLSearchParams(location.search).has('editBack')

  return (
    <div
      className="detached"
      style={
        instance.radius !== undefined
          ? ({ '--widget-radius': `${instance.radius}px` } as React.CSSProperties)
          : undefined
      }
    >
      {editingBack && (
        <div className="detached-editing" role="status">
          <span>
            {t(
              '✏️ Editando · al terminar vuelve al fondo',
              '✏️ Editing · when you finish it goes back to the background'
            )}
          </span>
          <button
            className="button-primary"
            onClick={() => window.api.widgetWindows.finishEditBack(id).catch(report)}
          >
            {t('Listo', 'Done')}
          </button>
        </div>
      )}
      <WidgetFrame
        instance={instance}
        def={def}
        showTitle={false}
        locked={instance.locked ?? false}
        onSetLocked={(locked) => window.api.desktop.setLocked(id, locked).catch(report)}
        shadow={entry?.shadow ?? false}
        onSetShadow={(shadow) => setOptions({ shadow })}
        pinBack={entry?.pinBack ?? false}
        onSetPinBack={(pinBack) => setOptions({ pinBack })}
        onAttach={() => window.api.widgetWindows.attach(id).catch(report)}
        onUpdateConfig={(patch) => window.api.desktop.updateConfig(id, patch).catch(report)}
      />
    </div>
  )
}
