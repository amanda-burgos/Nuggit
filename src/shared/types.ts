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

// What the macOS menu bar shows while a task is "En curso".
export type StatusIndicator = 'dot' | 'dot-title' | 'title' | 'off'

export interface Settings {
  ai: {
    provider: 'none' | 'gemini'
    model?: string
    shareTasksWithAI: boolean
  }
  theme: ThemePreference
  statusIndicator: StatusIndicator
  background?: string
}

export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  dueDate?: string // ISO date, YYYY-MM-DD
  estimateMin?: number
  category?: string
  status: TaskStatus
  parentId?: string // set when this task is a "tender" (subtask) of another task
  order: number // order inside its parent (or among top-level tasks)
  notes?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// Fields the interface may set. Empty strings / null clear an optional field.
export interface TaskInput {
  title?: string
  description?: string | null
  priority?: Priority
  dueDate?: string | null
  estimateMin?: number | null
  category?: string | null
  status?: TaskStatus
  notes?: string | null
}

export interface SettingsPatch {
  theme?: ThemePreference
  statusIndicator?: StatusIndicator
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
  tasks: {
    load(): Promise<Task[]>
    create(input: TaskInput & { title: string; parentId?: string }): Promise<Task>
    update(id: string, patch: TaskInput): Promise<void>
    // Removes the task and its subtasks; returns what was removed so it can be restored.
    remove(id: string): Promise<Task[]>
    // Puts back tasks returned by remove() (undo).
    restore(tasks: Task[]): Promise<void>
    // Called whenever any window changes the tasks.
    onChange(listener: (tasks: Task[]) => void): () => void
  }
  settings: {
    load(): Promise<Settings>
    update(patch: SettingsPatch): Promise<Settings>
    // Called when settings change from another window or the menu bar.
    onChange(listener: (settings: Settings) => void): () => void
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
