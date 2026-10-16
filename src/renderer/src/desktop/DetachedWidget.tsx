import { useEffect, useState } from 'react'
import type { DetachedWindowOptions, SavedDesktop } from '../../../shared/types'
import { getWidgetDefinition } from '../widgets/registry'
import { WidgetFrame } from './WidgetFrame'
import './desktop.css'

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

  return (
    <div className="detached">
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
