import type React from 'react'
import type { AppTab } from '../../../shared/types'
import { DipIcon } from '../theme/DipIcon'

export interface TabInfo {
  key: AppTab
  label: string
  icon: React.ReactNode
  shortcut: string // the key pressed with ⌘ ('' = no shortcut: ⌘1–⌘0 are taken)
  widgetType?: string // tabs that show a widget at full size
}

// SPEC 9.0. Every useful feature gets its tab.
export const TABS: TabInfo[] = [
  { key: 'home', label: 'Inicio', icon: '🏠', shortcut: '1' },
  { key: 'dip', label: 'Dip', icon: <DipIcon />, shortcut: '2', widgetType: 'dip' },
  { key: 'tasks', label: 'Tareas', icon: '✅', shortcut: '3', widgetType: 'tasks' },
  { key: 'next', label: 'Ahora', icon: '🎯', shortcut: '4', widgetType: 'next-action' },
  { key: 'tenders', label: 'Tenderizer', icon: '🪜', shortcut: '5', widgetType: 'tenders' },
  { key: 'dailies', label: 'Dailies', icon: '🔁', shortcut: '6', widgetType: 'dailies' },
  { key: 'notes', label: 'Notas', icon: '📝', shortcut: '7', widgetType: 'notes' },
  {
    key: 'brainDump',
    label: 'Brain Dump',
    icon: '🌪️',
    shortcut: '8',
    widgetType: 'brain-dump'
  },
  { key: 'focus', label: 'Focus', icon: '⏳', shortcut: '9', widgetType: 'focus' },
  { key: 'calendar', label: 'Calendario', icon: '📅', shortcut: '0', widgetType: 'calendar' },
  { key: 'music', label: 'Música', icon: '🎵', shortcut: '', widgetType: 'music' },
  { key: 'settings', label: 'Ajustes', icon: '⚙︎', shortcut: ',' }
]
