import type { AppTab } from '../../../shared/types'

export interface TabInfo {
  key: AppTab
  label: string
  icon: string
  shortcut: string // the key pressed with ⌘
  widgetType?: string // tabs that show a widget at full size
}

// SPEC 9.0. Later, when they exist: Notas, Focus.
export const TABS: TabInfo[] = [
  { key: 'home', label: 'Inicio', icon: '🏠', shortcut: '1' },
  { key: 'dip', label: 'Dip', icon: '🫙', shortcut: '2', widgetType: 'dip' },
  { key: 'tasks', label: 'Tareas', icon: '✅', shortcut: '3', widgetType: 'tasks' },
  { key: 'settings', label: 'Ajustes', icon: '⚙︎', shortcut: ',' }
]
