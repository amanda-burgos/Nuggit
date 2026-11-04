import { TasksSettings } from '../widgets/tasks/TasksSettings'
import { DipTraySettings } from './DipTraySettings'
import { MusicTraySettings } from './MusicTraySettings'
import { PickupTraySettings } from './PickupTraySettings'
import type { SectionProps } from './shared'
import { TrayName } from '../../../shared/keys'

// The icons Nuggit, Dip and the quick pickup put in the menu bar.
export function MenuBarSettings({ settings, update }: SectionProps): React.JSX.Element {
  return (
    <section className="settings-section">
      <h3>📍 {TrayName()}</h3>
      <TasksSettings />
      <DipTraySettings settings={settings} update={update} />
      <PickupTraySettings settings={settings} update={update} />
      <MusicTraySettings settings={settings} update={update} />
    </section>
  )
}
