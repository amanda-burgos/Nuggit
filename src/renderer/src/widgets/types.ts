import type React from 'react'

export interface WidgetProps<Config> {
  instanceId: string
  // The same component is used as a widget on the board and as a full tab (SPEC 9.0).
  size: 'widget' | 'full'
  config: Config
  updateConfig: (patch: Partial<Config>) => void
}

export interface WidgetSettingsProps<Config> {
  config: Config
  updateConfig: (patch: Partial<Config>) => void
}

export interface WidgetDefinition<Config = unknown> {
  type: string // unique id, e.g. "tasks"
  name: string // visible name, e.g. "Tareas"
  icon: string // emoji or icon name
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  maxSize?: { w: number; h: number }
  defaultConfig: Config
  component: React.FC<WidgetProps<Config>>
  settingsComponent?: React.FC<WidgetSettingsProps<Config>>
  needsAI?: boolean // if true, shows a friendly notice when no AI is connected
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetDefinition = WidgetDefinition<any>
