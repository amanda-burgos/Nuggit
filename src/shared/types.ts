// Types shared between the main process, preload and renderer.

// A widget's rectangle in pixels, relative to the top-left of the desktop board.
export interface WidgetRect {
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
  widgets: WidgetInstance[] // array order is the stacking order (last = on top)
  // Where each widget wants to be. If the window is too small it is drawn moved/shrunk
  // to fit, but this saved rect stays the same so it returns when the window grows.
  positions: Record<string, WidgetRect>
  gridVersion: number // layout format version, used to convert older saved files
}

// What may be on disk: the current format or an older grid-based one (converted on load).
export interface SavedDesktop {
  widgets: WidgetInstance[]
  positions?: Record<string, WidgetRect>
  gridVersion?: number
  layouts?: Record<string, Array<{ i: string; x: number; y: number; w: number; h: number }>>
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
    load(): Promise<SavedDesktop | null>
    save(state: DesktopState): Promise<void>
  }
  settings: {
    load(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }
}
