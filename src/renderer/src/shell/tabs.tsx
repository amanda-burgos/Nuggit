import type React from 'react'
import type { AppTab } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import { DipIcon } from '../theme/DipIcon'

export interface TabInfo {
  key: AppTab
  label: string
  icon: React.ReactNode
  shortcut: string // the key pressed with ⌘ ('' = no shortcut: ⌘1–⌘0 are taken)
  widgetType?: string // tabs that show a widget at full size
}

// SPEC 9.0. Every useful feature gets its tab. Labels are getters so they follow the language.
export const TABS: TabInfo[] = [
  {
    key: 'home',
    get label() {
      return t('Inicio', 'Home')
    },
    icon: '🏠',
    shortcut: '1'
  },
  { key: 'dip', label: 'Dip', icon: <DipIcon />, shortcut: '2', widgetType: 'dip' },
  {
    key: 'tasks',
    get label() {
      return t('Tareas', 'Tasks')
    },
    icon: '✅',
    shortcut: '3',
    widgetType: 'tasks'
  },
  {
    key: 'next',
    get label() {
      return t('Ahora', 'Now')
    },
    icon: '🎯',
    shortcut: '4',
    widgetType: 'next-action'
  },
  { key: 'tenders', label: 'Tenderizer', icon: '🪜', shortcut: '5', widgetType: 'tenders' },
  { key: 'dailies', label: 'Dailies', icon: '🔁', shortcut: '6', widgetType: 'dailies' },
  {
    key: 'notes',
    get label() {
      return t('Notas', 'Notes')
    },
    icon: '📝',
    shortcut: '7',
    widgetType: 'notes'
  },
  {
    key: 'brainDump',
    label: 'Brain Dump',
    icon: '🌪️',
    shortcut: '8',
    widgetType: 'brain-dump'
  },
  { key: 'focus', label: 'Focus', icon: '⏳', shortcut: '9', widgetType: 'focus' },
  {
    key: 'calendar',
    get label() {
      return t('Calendario', 'Calendar')
    },
    icon: '📅',
    shortcut: '0',
    widgetType: 'calendar'
  },
  {
    key: 'reminders',
    get label() {
      return t('Recordatorios', 'Reminders')
    },
    icon: '⏰',
    shortcut: '',
    widgetType: 'reminders'
  },
  {
    key: 'music',
    get label() {
      return t('Música', 'Music')
    },
    icon: '🎵',
    shortcut: '',
    widgetType: 'music'
  },
  {
    key: 'qotd',
    get label() {
      return 'QOTD'
    },
    icon: '💭',
    shortcut: '',
    widgetType: 'qotd'
  },
  {
    key: 'help',
    get label() {
      return t('Ayuda', 'Help')
    },
    icon: '❓',
    shortcut: ''
  },
  {
    key: 'settings',
    get label() {
      return t('Ajustes', 'Settings')
    },
    icon: '⚙︎',
    shortcut: ','
  }
]
