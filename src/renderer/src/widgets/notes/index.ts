import { t } from '../../../../shared/i18n'
import type { WidgetDefinition } from '../types'
import { NotesWidget, type NotesConfig } from './NotesWidget'

export const notesWidget: WidgetDefinition<NotesConfig> = {
  type: 'notes',
  get name() {
    return t('Notas', 'Notes')
  },
  icon: '📝',
  defaultSize: { w: 320, h: 380 },
  minSize: { w: 240, h: 200 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: {},
  component: NotesWidget
}
