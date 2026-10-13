import type { WidgetDefinition } from '../types'
import { TasksSettings } from './TasksSettings'
import { TasksWidget, type TasksConfig } from './TasksWidget'

export const tasksWidget: WidgetDefinition<TasksConfig> = {
  type: 'tasks',
  name: 'Tareas',
  icon: '✅',
  defaultSize: { w: 380, h: 460 },
  minSize: { w: 260, h: 220 },
  maxSize: { w: 900, h: 1400 },
  defaultConfig: { collapsed: {} },
  component: TasksWidget,
  settingsComponent: TasksSettings
}
