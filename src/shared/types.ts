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

// A widget popped out of the board into its own window on the computer's desktop.
export interface DetachedWidget {
  bounds: WidgetRect // screen pixels
  alwaysOnTop: boolean
}

export interface DesktopState {
  widgets: WidgetInstance[] // array order is the stacking order (last = on top)
  // Where each widget wants to be. If the window is too small it is drawn moved/shrunk
  // to fit, but this saved rect stays the same so it returns when the window grows.
  // Detached widgets keep their board rect, so "Regresar" puts them back where they were.
  positions: Record<string, WidgetRect>
  // Widgets living in their own window, by widget id. Owned by the main process.
  detached: Record<string, DetachedWidget>
  gridVersion: number // layout format version, used to convert older saved files
}

// What may be on disk: the current format or an older grid-based one (converted on load).
export interface SavedDesktop {
  widgets: WidgetInstance[]
  positions?: Record<string, WidgetRect>
  detached?: Record<string, DetachedWidget>
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
    updateConfig(id: string, patch: Record<string, unknown>): Promise<void>
    // Called whenever another window (or the main process) changes the desktop.
    onChange(listener: (state: SavedDesktop) => void): () => void
  }
  settings: {
    load(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
  }
  widgetWindows: {
    // rect is relative to the calling window's content area.
    detach(id: string, rect: WidgetRect): Promise<void>
    attach(id: string): Promise<void>
    setAlwaysOnTop(id: string, alwaysOnTop: boolean): Promise<void>
    // Hides or shows every detached widget (for Lockdown).
    setAllVisible(visible: boolean): Promise<void>
    // Size limits for the calling detached window.
    setSizeLimits(min?: { w: number; h: number }, max?: { w: number; h: number }): void
  }
}
