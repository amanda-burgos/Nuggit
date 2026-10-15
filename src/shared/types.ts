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
  shadow?: boolean // macOS window shadow; off unless turned on
}

export type DetachedWindowOptions = Partial<Pick<DetachedWidget, 'alwaysOnTop' | 'shadow'>>

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

// Tabs of the control center (SPEC 9.0).
export type AppTab = 'home' | 'dip' | 'tasks' | 'settings'

export interface UISettings {
  tab: AppTab // last open tab
  sidebarCollapsed: boolean
  // Options of the full-size panels (e.g. folded task groups), by widget type.
  panels: Record<string, Record<string, unknown>>
}

// What the macOS menu bar shows while a task is "En curso".
export type StatusIndicator = 'dot' | 'dot-title' | 'title' | 'off'

// Gemini runs online with a key; Ollama runs on this computer. "auto" (the default) uses
// whichever is available. "none" is only found in older settings files (read as "auto").
export type AIProviderId = 'none' | 'gemini' | 'ollama' | 'auto'
export type AIBackend = 'gemini' | 'ollama'

export interface Settings {
  ai: {
    provider: AIProviderId
    model?: string // Gemini model
    ollamaModel?: string // local Ollama model; the first installed one if not set
    shareTasksWithAI: boolean
  }
  theme: ThemePreference
  statusIndicator: StatusIndicator
  dipPersonality?: string // the user's changes to Dip's personality; unset = original Dip
  ui: UISettings
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
  dipPersonality?: string | null // null or '' restores the original Dip
  ui?: {
    tab?: AppTab
    sidebarCollapsed?: boolean
    panel?: { type: string; config: Record<string, unknown> } // replaces that panel's options
  }
  // The provider is not here: it is set through window.api.ai.setProvider.
  ai?: {
    model?: string | null // null or '' goes back to the default model
    ollamaModel?: string | null
    shareTasksWithAI?: boolean
  }
}

// --- AI ---

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIModelOption {
  id: string // e.g. "gemini-flash-latest"
  label: string
}

// AI calls never throw across IPC: they return a friendly message to show instead.
export type AIChatResult =
  { ok: true; text: string; backend: AIBackend } | { ok: false; error: string }
export type AITestResult =
  | { ok: true; backend: AIBackend; model: string; models: AIModelOption[] }
  | { ok: false; error: string }
// The conversation with Dip, shared by every window. Kept in dip-chat.json.
export interface DipChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string // ISO date-time
}

export interface DipChatState {
  messages: DipChatMessage[]
  pending: boolean // Dip is answering
}

// --- Tenders (SPEC 9.3): a big task split into small steps ---

export interface TenderStep {
  title: string
  minutes: number
}

export interface TenderAnswer {
  question: string
  answer: string // may be empty if the user skipped it
}

export interface TenderRequest {
  task: string // what the user wrote, e.g. "proyecto de ciencias"
  answers: TenderAnswer[]
  feedback?: string // "Cambiar": what to change about the previous proposal
  previous?: TenderStep[]
}

export type TenderQuestionsResult = { ok: true; questions: string[] } | { ok: false; error: string }

export type TenderPlanResult =
  { ok: true; title: string; dueDate?: string; steps: TenderStep[] } | { ok: false; error: string }

// Dip's suggestion for a new personality text, to approve before saving.
export type AIPersonalityResult =
  { ok: true; reply: string; personality: string } | { ok: false; error: string }

// What Dip can use right now. Ollama counts only when it is open and has a model.
export interface AIStatus {
  active: AIBackend | null // what the next chat will use (null = no AI available)
  gemini: boolean // a key is saved
  ollama: boolean
}

export type AISaveKeyResult = { ok: true } | { ok: false; error: string }

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
    // Creates a big task and its tenders in one go; returns them (parent first).
    createWithSteps(input: {
      title: string
      dueDate?: string
      steps: TenderStep[]
    }): Promise<Task[]>
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
  ai: {
    // The key goes to the main process and is never sent back to the interface.
    saveKey(key: string): Promise<AISaveKeyResult>
    removeKey(): Promise<void>
    setProvider(provider: 'auto' | 'gemini' | 'ollama'): Promise<void>
    status(): Promise<AIStatus>
    // Called when what Dip can use changes (key saved, Ollama opened or closed...).
    onStatusChange(listener: (status: AIStatus) => void): () => void
    // Tests what Dip is using right now.
    test(): Promise<AITestResult>
    // Only "user" and "assistant" messages; Dip's instructions are added by the main process.
    chat(messages: AIMessage[]): Promise<AIChatResult>
    // Tenders: 2 or 3 short questions about a big task, then a proposal of small steps.
    tenderQuestions(task: string): Promise<TenderQuestionsResult>
    proposeTenders(request: TenderRequest): Promise<TenderPlanResult>
    // A conversation about how Dip should be; returns a proposed personality text.
    proposePersonality(messages: AIMessage[]): Promise<AIPersonalityResult>
  }
  dipChat: {
    load(): Promise<DipChatState>
    // Adds the user's message to the shared conversation and gets Dip's answer.
    send(text: string): Promise<AIChatResult>
    retry(): Promise<AIChatResult>
    clear(): Promise<void>
    onChange(listener: (state: DipChatState) => void): () => void
  }
  app: {
    // Brings up the main window with Settings open (works from detached widgets too).
    openSettings(): void
    onOpenSettings(listener: () => void): () => void
  }
  widgetWindows: {
    // rect is relative to the calling window's content area.
    detach(id: string, rect: WidgetRect): Promise<void>
    attach(id: string): Promise<void>
    setOptions(id: string, options: DetachedWindowOptions): Promise<void>
    // Hides or shows every detached widget (for Lockdown).
    setAllVisible(visible: boolean): Promise<void>
    // Size limits for the calling detached window.
    setSizeLimits(min?: { w: number; h: number }, max?: { w: number; h: number }): void
  }
}
