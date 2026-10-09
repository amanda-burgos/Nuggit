// Types shared between the main process, preload and renderer.

export type Breakpoint = 'lg' | 'md' | 'sm'

export interface LayoutEntry {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface WidgetInstance {
  id: string // unique per instance
  type: string // points to WidgetDefinition.type
  config: unknown
  hidden: boolean
}

export interface DesktopState {
  widgets: WidgetInstance[]
  layouts: Record<Breakpoint, LayoutEntry[]>
  gridVersion?: number // grid scale the layouts were saved with (missing = 1)
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  ai: {
    provider: 'none' | 'gemini'
    model?: string
    shareTasksWithAI: boolean
  }
  theme: ThemePreference
  background?: string
}

export interface SettingsPatch {
  theme?: ThemePreference
}

// API exposed by the preload script on `window.api`.
export interface NuggitApi {
  desktop: {
    load(): Promise<DesktopState | null>
    save(state: DesktopState): Promise<void>
  }
  settings: {
    load(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }
}
