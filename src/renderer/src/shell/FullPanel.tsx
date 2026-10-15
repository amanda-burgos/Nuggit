import type { Settings, SettingsPatch } from '../../../shared/types'
import { AINotice } from '../desktop/AINotice'
import { useAIStatus } from '../store/useAIStatus'
import { getWidgetDefinition } from '../widgets/registry'

interface Props {
  type: string
  settings: Settings
  update(patch: SettingsPatch): void
}

// A widget shown big in its own tab, using the same component as on the board.
// Its options (e.g. folded groups) are kept apart from the board's widgets.
export function FullPanel({ type, settings, update }: Props): React.JSX.Element | null {
  const aiStatus = useAIStatus()
  const def = getWidgetDefinition(type)
  if (!def) return null

  const config = { ...def.defaultConfig, ...settings.ui.panels[type] }
  const Widget = def.component
  const missingAI = def.needsAI && aiStatus !== null && aiStatus.active === null

  return (
    <div className="panel">
      <header className="panel-header">
        <h1>
          <span aria-hidden>{def.icon}</span> {def.name}
        </h1>
      </header>
      <div className="panel-body">
        {missingAI ? (
          <AINotice />
        ) : (
          <Widget
            instanceId={`panel:${type}`}
            size="full"
            config={config}
            updateConfig={(patch: Record<string, unknown>) =>
              update({ ui: { panel: { type, config: { ...config, ...patch } } } })
            }
          />
        )}
      </div>
    </div>
  )
}
