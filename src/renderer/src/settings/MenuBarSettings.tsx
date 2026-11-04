import { TasksSettings } from '../widgets/tasks/TasksSettings'
import { DipTraySettings } from './DipTraySettings'
import { MusicTraySettings } from './MusicTraySettings'
import { PickupTraySettings } from './PickupTraySettings'
import type { SectionProps } from './shared'
import { t } from '../../../shared/i18n'

// The icons Nuggit, Dip and the quick pickup put in the menu bar.
export function MenuBarSettings({ settings, update }: SectionProps): React.JSX.Element {
  return (
    <section className="settings-section">
      <h3>📍 {t('Barra de menú', 'Menu bar')}</h3>
      <TasksSettings />
      <DipTraySettings settings={settings} update={update} />
      <PickupTraySettings settings={settings} update={update} />
      <MusicTraySettings settings={settings} update={update} />
    </section>
  )
}
