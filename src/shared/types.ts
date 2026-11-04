import type { Lang } from './i18n'
import type { UpdateInfo } from './updates'
import type { SystemVoice } from './voices'

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
  locked?: boolean // "Fijar": can't be moved or resized, no edit controls (SPEC 9.16)
  background?: Background // its own background, over the general one (Fase 9); unset = general
  radius?: number // its own corner roundness in px, over the general one; unset = general
  font?: string // Fase 13: its own font (a FontPreset id or "mac:<family>"); unset = general
  textScale?: number // its own text size, WIDGET_TEXT_MIN–MAX (1 = normal); unset = normal
}

// A background (board or widgets, Fase 9). Images are copies kept in Nuggit's data folder,
// named by file ("4f1c….jpg"), shown through the nuggit-img:// protocol.
export type Background =
  | { kind: 'default' }
  | { kind: 'color'; color: string } // #rrggbb
  | { kind: 'image'; image: string }

// How round widget corners can be, in px (Ajustes → Apariencia and each widget's ⚙︎).
export const WIDGET_RADIUS_MIN = 0
export const WIDGET_RADIUS_MAX = 32

// Fase 13: fonts. A font is a bundled/system preset id ("system", "nunito"…) or
// "mac:<family>" for a font installed on this Mac. Text size is a scale of the base size.
export const DEFAULT_FONT = 'system'
export const FONT_SCALE_MIN = 0.85
export const FONT_SCALE_MAX = 1.3
// A widget's own text size (its ⚙︎), over the app's: big enough for a wall clock.
export const WIDGET_TEXT_MIN = 0.7
export const WIDGET_TEXT_MAX = 2.5

// Fase 16: Vestidor del mouse. The cursor inside Nuggit's windows and an optional trail.
export const MOUSE_SHAPES = [
  'arrow',
  'arrow-round',
  'pencil',
  'plane',
  'star',
  'heart',
  'dip',
  'kitty',
  'paw',
  'bolt'
] as const
export type MouseShape = 'system' | (typeof MOUSE_SHAPES)[number] // 'system' = the computer's own
export type MouseSize = 'small' | 'medium' | 'large'
export const MOUSE_SIZE_PX: Record<MouseSize, number> = { small: 24, medium: 32, large: 48 }
export const TRAIL_STYLES = [
  'sparkles',
  'stars',
  'hearts',
  'paws',
  'dots',
  'bubbles',
  'comet',
  'rainbow'
] as const
export type TrailStyle = (typeof TRAIL_STYLES)[number]
export type TrailColorMode = 'one' | 'alternate' | 'rainbow'
export const TRAIL_MAX_STYLES = 2
export const TRAIL_MAX_COLORS = 4
export const TRAIL_LENGTH_MIN = 1
export const TRAIL_LENGTH_MAX = 10
export const MOUSE_FAVORITES_MAX = 30
export const MOUSE_NAME_MAX = 40

export interface TrailLayer {
  style: TrailStyle
  mode: TrailColorMode // one color, several alternating, or rainbow
  colors: string[] // #rrggbb, 1–TRAIL_MAX_COLORS ('one' uses the first)
}

export interface MouseStyle {
  shape: MouseShape
  size: MouseSize
  colors: {
    fill: string // #rrggbb
    fill2?: string // a second fill color: a gradient; unset = solid
    border: string
    details: string // the paw's beans, Dip's bolt, the kitty's face…
  }
  trail: {
    on: boolean
    styles: TrailLayer[] // up to TRAIL_MAX_STYLES at once
    length: number // TRAIL_LENGTH_MIN–MAX
    fade: 'fast' | 'slow'
  }
  typingPause: boolean // no trail while typing in a text field
  focusPause: boolean // no trail during a Focus round
}

export interface MouseFavorite {
  id: string
  name: string // ≤ MOUSE_NAME_MAX
  style: MouseStyle
}

// Ajustes → Apariencia (Fase 9).
export interface AppearanceSettings {
  accent: string // a preset name ("lavender"…) or a #rrggbb color
  board: Background // behind the widgets on Inicio
  boardOpacity: number // 0.1–1: how strongly the board background shows
  boardEverywhere: boolean // the board background also behind the other tabs
  themeColor?: string // #rrggbb: Tema "Mi color", the app's own base color; unset = light/dark
  widgetBackground: Background // every widget, unless one has its own
  widgetShadow: boolean
  widgetOpacity: number // 0.6–1: how solid the widgets are
  widgetRadius: number // px, WIDGET_RADIUS_MIN–MAX: how round the widget corners are
  font: string // Fase 13: the app's font
  headingFont?: string // the titles' font; unset = same as the text
  fontScale: number // FONT_SCALE_MIN–MAX: how big the text is
  fontAuto: boolean // the main window's text follows its size (smaller window, smaller text)
  mouse: MouseStyle // Fase 16: the cursor and its trail; default = the system cursor, no trail
}

// A widget popped out of the board into its own window on the computer's desktop.
export interface DetachedWidget {
  bounds: WidgetRect // screen pixels
  alwaysOnTop: boolean // "Pin on top", only set from the quick pickup (SPEC 9.16)
  allSpaces?: boolean // with alwaysOnTop: on every desktop (Space) and over full screen apps; unset = yes
  // "Pin on back": behind every window, at the level of the desktop picture (behind its
  // files and icons). macOS sends such a window no clicks. Never together with alwaysOnTop.
  pinBack?: boolean
  shadow?: boolean // macOS window shadow; off unless turned on
}

export type DetachedWindowOptions = Partial<
  Pick<DetachedWidget, 'alwaysOnTop' | 'allSpaces' | 'pinBack' | 'shadow'>
>

// Where the quick pickup lives: its own menu bar icon, inside Nuggit's menu, or nowhere.
export type PickupTrayMode = 'icon' | 'menu' | 'off'

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

// Global shortcut that opens Dip's mini chat from any app ('' = none).
// Electron accelerators: CommandOrControl is ⌘ on a Mac and Ctrl on Windows/Linux.
export type DipShortcut = '' | 'Alt+Space' | 'Control+Alt+Space' | 'CommandOrControl+Shift+Space'

// Tabs of the control center (SPEC 9.0).
export type AppTab =
  | 'home'
  | 'dip'
  | 'tasks'
  | 'next'
  | 'tenders'
  | 'dailies'
  | 'notes'
  | 'brainDump'
  | 'focus'
  | 'calendar'
  | 'music'
  | 'qotd'
  | 'reminders'
  | 'help'
  | 'settings'

// For Ajustes → General and Acerca de.
export interface AppInfo {
  version: string
  dataPath: string // where Nuggit keeps your data
  openAtLogin: boolean
  packaged: boolean // false while developing (then the login item opens Electron)
}

// The tabs inside Ajustes (SPEC 9.0).
export type SettingsTab =
  'general' | 'appearance' | 'dip' | 'ai' | 'voice' | 'calendar' | 'music' | 'menubar' | 'about'

export interface UISettings {
  tab: AppTab // last open tab
  settingsTab?: SettingsTab // last open tab inside Ajustes
  sidebarCollapsed: boolean
  // Options of the full-size panels (e.g. folded task groups), by widget type.
  panels: Record<string, Record<string, unknown>>
}

// What the macOS menu bar shows while a task is "En curso".
export type StatusIndicator = 'dot' | 'dot-title' | 'title' | 'off'

// Gemini runs online with a key; Ollama runs on this computer; "custom" is the user's own
// server that speaks the OpenAI API. "auto" (the default) uses the first available one, in
// the user's order. "none" is only found in older settings files (read as "auto").
export type AIProviderId = 'none' | 'gemini' | 'ollama' | 'custom' | 'auto'
export type AIBackend = 'gemini' | 'ollama' | 'custom'

// The user's own OpenAI-compatible server (SPEC 8). These addresses are the user's data:
// they live in settings.json only, never in the code. The optional key is kept encrypted
// apart, like Gemini's.
export interface CustomServerSettings {
  name: string // what Nuggit calls it, e.g. "Mi servidor"
  model: string
  servers: string[] // base URLs ending in /v1: the main one first, then the backups in order
}

export interface Settings {
  ai: {
    provider: AIProviderId
    model?: string // Gemini model
    ollamaModel?: string // local Ollama model; the first installed one if not set
    custom?: CustomServerSettings
    order?: AIBackend[] // the order "auto" tries them in; default: Gemini, Ollama, custom
    shareTasksWithAI: boolean
  }
  theme: ThemePreference
  statusIndicator: StatusIndicator
  dipTray: { visible: boolean; shortcut: DipShortcut } // Dip's own menu bar icon (9.15)
  pickupTray: PickupTrayMode // the quick pickup's menu bar icon (9.16)
  musicTray?: PickupTrayMode // the music player's menu bar icon (9.19); unset: icon if Spotify is there
  dipPersonality?: string // the user's changes to Dip's personality; unset = original Dip
  voice: VoiceSettings // SPEC 9.10
  calendar: CalendarSettings // SPEC 9.14
  music: MusicSettings // SPEC 9.19
  ui: UISettings
  appearance: AppearanceSettings
  onboarding: OnboardingSettings
  qotdTopics: string[] // Fase 11: the topics you like, each with its own question of the day ('general' = the random one)
  qotdSetup?: boolean // QOTD's first-time "choose at least 1" is done
  qotdCustomTopics: QotdCustomTopic[] // topics you wrote yourself
  language?: Lang // Fase 14: the app's language; unset = not chosen yet (asked on first open)
  mouseFavorites: MouseFavorite[] // Fase 16: saved cursor + trail combos (up to MOUSE_FAVORITES_MAX)
}

// A Pregunta del día topic you wrote ("K-pop"); its id starts with "mi-".
export interface QotdCustomTopic {
  id: string
  label: string
}

// Fase 10: the welcome tour and "Qué hay de nuevo".
export interface OnboardingSettings {
  tourDone: boolean // the welcome tour was finished or skipped
  whatsNew: boolean // show "Qué hay de nuevo" after an update (Ajustes → General)
  lastSeenVersion?: string // the version whose news were already shown
  lastSeenNews?: string // the newest 📣 Novedades date already seen (AAAA-MM-DD)
}

// Dip answering out loud with the system voice (SPEC 9.10). Talking to Dip uses the
// system's dictation, which has no settings here.
export interface VoiceSettings {
  speak: boolean // Dip reads its answers aloud
  voiceURI?: string // the chosen system voice (SystemVoice.id); unset = the best one
  rate: number // 0.5–2
  pitch: number // 0.8 (deeper) – 1.25 (higher)
  // Call mode (SPEC 9.10): who turns speech into text, and in which language.
  stt?: 'auto' | SttBackend
  whisperModel?: 'base' | 'small'
  callLang?: 'auto' | 'es' | 'en'
}

// Speech to text: whisper.cpp on this Mac, the user's own server, or Gemini.
export type SttBackend = 'whisper' | 'custom' | 'gemini'

// What the call mode can use to understand speech (Ajustes → Voz).
export interface SttStatus {
  active: SttBackend | null
  provider: 'auto' | SttBackend
  fromEnv: boolean
  whisper: {
    bin: string | null // the whisper-cli found (brew install whisper-cpp)
    model: 'base' | 'small'
    modelReady: boolean
    modelSizeMB: number
  }
  custom: boolean // a server of your own is set up (it may not do audio)
  gemini: boolean // a Gemini key is saved
}

export type TranscribeResult =
  { ok: true; text: string; backend: SttBackend } | { ok: false; error: string }

// Downloading a whisper model: progress 0–1, then done (or an error).
export type ModelDownload =
  { state: 'downloading'; progress: number } | { state: 'done' } | { state: 'error'; error: string }

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
  dailyId?: string // set on today's copy of a daily (SPEC 9.13); made by Nuggit, not by hand
  order: number // order inside its parent (or among top-level tasks)
  notes?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// --- Dailies (SPEC 9.13): things that repeat on a schedule ---

export type DailyRepeat =
  | { kind: 'every-day' }
  | { kind: 'weekdays'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { kind: 'every-n'; n: number; start: string } // every n days counting from start (YYYY-MM-DD)

export interface Daily {
  id: string
  title: string
  repeat: DailyRepeat
  time?: string // HH:MM, optional
  estimateMin?: number
  streak: boolean // show how many times in a row (never a guilt trip when it breaks)
  done: string[] // dates (YYYY-MM-DD) it was done, most recent last
  lastMade?: string // the last day its task for "hoy" was made (so a deleted one stays gone)
  order: number
  createdAt: string
  updatedAt: string
}

export interface DailyInput {
  title?: string
  repeat?: DailyRepeat
  time?: string | null
  estimateMin?: number | null
  streak?: boolean
}

// "Planear con Dip": the routine Dip proposes, to edit and approve before saving.
export interface DailyPlanRequest {
  request: string // e.g. "ayúdame a armar mi rutina de la semana"
  answers: TenderAnswer[]
  feedback?: string // "Cambiar": what to change about the previous proposal
  previous?: DailyInput[]
}

export type DailyPlanResult =
  | { ok: true; dailies: Array<Required<Pick<DailyInput, 'title' | 'repeat'>> & DailyInput> }
  | { ok: false; error: string }

// A task's status before a change, so it can be undone.
export interface TaskStatusChange {
  id: string
  status: TaskStatus
}

// Next Action (SPEC 9.5): what the user said today. Owned by the main process so the
// widget and the menu bar agree. It is reset when the day changes.
export interface NextActionState {
  day: string // YYYY-MM-DD the values below belong to
  skipped: string[] // task ids sent to the back of the line with "Saltar", oldest first
  availableMin: number | null // "Tengo 30 min"; null = no limit
}

// "Solo empieza": a 2-minute version of a step.
export type TinyStepResult = { ok: true; text: string; byAI: boolean }

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
  dipTray?: { visible?: boolean; shortcut?: DipShortcut }
  pickupTray?: PickupTrayMode
  musicTray?: PickupTrayMode
  dipPersonality?: string | null // null or '' restores the original Dip
  calendar?: Partial<CalendarSettings>
  onboarding?: Partial<OnboardingSettings>
  qotdTopics?: string[]
  qotdSetup?: boolean
  qotdCustomTopics?: QotdCustomTopic[]
  language?: Lang
  mouseFavorites?: MouseFavorite[] // replaces the whole list
  // themeColor: null = back to light/dark
  appearance?: Partial<Omit<AppearanceSettings, 'themeColor' | 'headingFont'>> & {
    themeColor?: string | null
    headingFont?: string | null // null = same as the text
  }
  music?: {
    enabled?: boolean
    focusPlaylist?: string | null // a link or URI; null or '' removes it
    onBreak?: 'pause' | 'playlist'
    breakPlaylist?: string | null
    playlists?: SavedPlaylist[]
  }
  voice?: {
    speak?: boolean
    voiceURI?: string | null // null: the best voice
    rate?: number
    pitch?: number
    stt?: 'auto' | SttBackend
    whisperModel?: 'base' | 'small'
    callLang?: 'auto' | 'es' | 'en'
  }
  ui?: {
    tab?: AppTab
    settingsTab?: SettingsTab
    sidebarCollapsed?: boolean
    panel?: { type: string; config: Record<string, unknown> } // replaces that panel's options
  }
  // The provider is not here: it is set through window.api.ai.setProvider.
  ai?: {
    model?: string | null // null or '' goes back to the default model
    ollamaModel?: string | null
    custom?: CustomServerSettings | null // null removes the server
    order?: AIBackend[]
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
// Something Dip proposes to change. It is shown as a card and only happens if the user
// confirms it (SPEC 8, "Acciones de la IA").
export interface DipTaskFields {
  title?: string
  dueDate?: string // YYYY-MM-DD
  priority?: Priority
}

export type DipAction =
  | ({ type: 'create'; title: string } & DipTaskFields)
  | { type: 'complete'; taskId: string; taskTitle: string }
  | { type: 'update'; taskId: string; taskTitle: string; changes: DipTaskFields }

export type DipActionState = 'pending' | 'saved' | 'cancelled' | 'undone'

// Edits made with "Cambiar" before saving.
export interface DipActionEdits extends DipTaskFields {
  taskId?: string // complete: a different task
}

export interface DipChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string // ISO date-time
  action?: DipAction
  actionState?: DipActionState
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

// --- Calendar (SPEC 9.14) ---

// Calendars are optional: Nuggit works with none, one or both ways turned on.
export interface CalendarSettings {
  feed: boolean // Paso 1: the .ics feed the Mac's Calendar subscribes to
  apple: boolean // Paso 2: two-way with the Mac's Calendar app
  showCalendars: string[] // the Mac calendars whose events Nuggit shows (by name)
  writeToApple: boolean // keep a "Nuggit" calendar there with your tasks and dailies
  autoSync: boolean // true: after every change and every 10 min; false: only "Sincronizar ahora"
}

// An event from the Mac's calendar, shown in Nuggit (never changed by Nuggit).
export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  allDay: boolean
  calendar: string
}

export interface CalendarStatus {
  feedUrl: string | null // webcal://… while the feed is on
  apple: 'off' | 'syncing' | 'ok' | 'denied' | 'error'
  lastSync: string | null // ISO
  error: string | null
  moved: number // tasks moved to another day in Calendar, since Nuggit started
}

// --- Music in Focus (SPEC 9.19) ---

export interface MusicSettings {
  enabled: boolean // play music while Focus runs
  focusPlaylist?: string // a Spotify URI, e.g. "spotify:playlist:…"
  onBreak: 'pause' | 'playlist'
  breakPlaylist?: string
  playlists: SavedPlaylist[] // to choose from in the Música widget (SPEC 9.19)
}

// A playlist (or album…) saved by its link; its name and picture come from Spotify.
export interface SavedPlaylist {
  uri: string
  name: string
  image?: string
}

// What the Spotify app on this Mac is doing.
export interface MusicStatus {
  app: 'not-installed' | 'closed' | 'ready' | 'denied'
  playing: boolean
  track: string | null
  artist: string | null
  artwork?: string | null // the album cover (https, Spotify's servers)
  volume?: number | null // 0–100
  position?: number | null // seconds into the song
  duration?: number | null // seconds
}

// --- Focus (SPEC 9.8) ---

export interface FocusPreset {
  focusMin: number
  breakMin: number
}

export type FocusPhase = 'idle' | 'focus' | 'break'

// The timer lives in the main process, so every window shows the same one.
export interface FocusState {
  preset: FocusPreset
  phase: FocusPhase
  endsAt: string | null // ISO, while running
  pausedLeftMs: number | null // while paused: time left
  durationMs: number // of the current phase
  taskId: string | null // the task chosen; null = Next Action's
  rounds: number // focus rounds finished on roundsDay
  roundsDay: string // YYYY-MM-DD
}

// --- Quick Notes (SPEC 9.7) and Brain Dump (9.6) ---

export interface Note {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

// Fase 11: what you did with a question of the day (qotd.json, by card: "AAAA-MM-DD" for
// the general one, "AAAA-MM-DD:tema" for a topic's).
export interface QotdDay {
  skip: number // how many times "Otra" was pressed
  question?: string // the question you answered (kept, so old answers keep their question)
  kind?: string
  answer?: string
  answeredAt?: string
}

export type QotdState = Record<string, QotdDay>

// --- Recordatorios (Fase 12): a system notice at a time, once or repeating ---

export type ReminderRepeat = { kind: 'once' } | DailyRepeat

export interface Reminder {
  id: string
  title: string
  date: string // YYYY-MM-DD: the day (once) or the first day (repeating)
  time: string // HH:MM
  repeat: ReminderRepeat
  // Local "YYYY-MM-DDTHH:MM": every time at or before it already rang (or was skipped).
  after: string
  snoozeUntil?: string // ISO: "Posponer" rings it again then
  rangAt?: string // ISO: when it last rang (for "Posponer" right after)
  createdAt: string
  updatedAt: string
}

export interface ReminderInput {
  title?: string
  date?: string
  time?: string
  repeat?: ReminderRepeat
}

// What Dip proposes from a brain dump, to review before saving.
export interface BrainDumpTask {
  title: string
  dueDate?: string // YYYY-MM-DD
  priority?: Priority
}

export type BrainDumpResult =
  { ok: true; tasks: BrainDumpTask[]; notes: string[] } | { ok: false; error: string }

// Dip's suggestion for a new personality text, to approve before saving.
export type AIPersonalityResult =
  { ok: true; reply: string; personality: string } | { ok: false; error: string }

// What Dip can use right now. Ollama counts only when it is open and has a model.
export interface AIStatus {
  active: AIBackend | null // what the next chat will use (null = no AI available)
  gemini: boolean // a key is saved
  ollama: boolean
  custom: boolean // one of the user's servers answers
  customKey: boolean // a key for the user's server is saved
}

export type AISaveKeyResult = { ok: true } | { ok: false; error: string }

// SPEC 8.1: the provider and model each agent uses, and where that comes from: the
// environment (.env), Ajustes or config/ai.defaults.json.
export type AIConfigSource = 'env' | 'settings' | 'default'

export interface AIAgentInfo {
  name: string
  label: string
  purpose: string
  provider: 'auto' | AIBackend
  providerSource: AIConfigSource
  backend: AIBackend | null // what it would use right now (null = nothing available)
  model: string // of that backend; '' = the provider picks (Ollama: the first installed)
  modelSource: AIConfigSource
}

export interface AIAgentsInfo {
  agents: AIAgentInfo[]
  envFile: string | null // the .env that was loaded, if any
  logFile: string // logs/agents.log
}

// API exposed by the preload script on `window.api`.
export interface NuggitApi {
  desktop: {
    load(): Promise<SavedDesktop | null>
    save(state: DesktopState): Promise<void>
    updateConfig(id: string, patch: Record<string, unknown>): Promise<void>
    // "Fijar" (works for board and detached widgets).
    setLocked(id: string, locked: boolean): Promise<void>
    // Fase 9: a widget's own background; null = back to the general one.
    setBackground(id: string, background: Background | null): Promise<void>
    // A widget's own corner roundness in px; null = back to the general one.
    setRadius(id: string, radius: number | null): Promise<void>
    // Fase 13: a widget's own font; null = back to the general one.
    setFont(id: string, font: string | null): Promise<void>
    // A widget's own text size (1 = normal); null = back to normal.
    setTextScale(id: string, scale: number | null): Promise<void>
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
    // Marks a task or tender as done. If it was the last pending tender, its big task is
    // done too. Returns what changed, so it can be undone with restoreStatuses().
    complete(id: string): Promise<TaskStatusChange[]>
    restoreStatuses(changes: TaskStatusChange[]): Promise<void>
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
    setProvider(provider: 'auto' | AIBackend): Promise<void>
    // The optional key of the user's own server (kept encrypted, never sent back).
    saveServerKey(key: string): Promise<AISaveKeyResult>
    removeServerKey(): Promise<void>
    status(): Promise<AIStatus>
    // Which provider and model each agent uses, and where that comes from.
    agents(): Promise<AIAgentsInfo>
    // Called when what Dip can use changes (key saved, Ollama opened or closed...).
    onStatusChange(listener: (status: AIStatus) => void): () => void
    // Tests what Dip is using right now.
    test(): Promise<AITestResult>
    // Only "user" and "assistant" messages; Dip's instructions are added by the main process.
    chat(messages: AIMessage[]): Promise<AIChatResult>
    // Tenders: 2 or 3 short questions about a big task, then a proposal of small steps.
    tenderQuestions(task: string): Promise<TenderQuestionsResult>
    proposeTenders(request: TenderRequest): Promise<TenderPlanResult>
    // "Planear con Dip": 2 or 3 short questions about the routine, then a proposal.
    dailyQuestions(request: string): Promise<TenderQuestionsResult>
    proposeDailies(request: DailyPlanRequest): Promise<DailyPlanResult>
    // A conversation about how Dip should be; returns a proposed personality text.
    proposePersonality(messages: AIMessage[]): Promise<AIPersonalityResult>
    // Brain Dump: Dip splits the text into tasks and notes. Nothing is saved.
    brainDump(text: string): Promise<BrainDumpResult>
  }
  dipChat: {
    load(): Promise<DipChatState>
    // Adds the user's message to the shared conversation and gets Dip's answer.
    // voice: it was said in a call, so Dip answers short and spoken (SPEC 9.10).
    send(text: string, options?: { voice?: boolean }): Promise<AIChatResult>
    retry(): Promise<AIChatResult>
    clear(): Promise<void>
    // The action card of a message: save it (with optional edits), cancel it, or undo it.
    applyAction(messageId: string, edits?: DipActionEdits): Promise<{ ok: boolean; error?: string }>
    cancelAction(messageId: string): Promise<void>
    undoAction(messageId: string): Promise<void>
    onChange(listener: (state: DipChatState) => void): () => void
  }
  nextAction: {
    load(): Promise<NextActionState>
    setAvailable(minutes: number | null): Promise<void>
    // "Saltar": sends that task or tender to the back of the line.
    skip(taskId: string): Promise<void>
    // "Empezar": the task becomes "En curso".
    start(taskId: string): Promise<void>
    // "Solo empieza": a 2-minute version of the step (Dip's, or a simple one without AI).
    tinyStep(taskId: string): Promise<TinyStepResult>
    onChange(listener: (state: NextActionState) => void): () => void
  }
  dailies: {
    load(): Promise<Daily[]>
    create(input: DailyInput & { title: string; repeat: DailyRepeat }): Promise<Daily>
    // Several at once ("Planear con Dip"); returns them, so they can be undone.
    createMany(inputs: Array<DailyInput & { title: string; repeat: DailyRepeat }>): Promise<Daily[]>
    update(id: string, patch: DailyInput): Promise<void>
    remove(ids: string[]): Promise<void>
    onChange(listener: (dailies: Daily[]) => void): () => void
  }
  qotd: {
    load(): Promise<QotdState>
    // Saves (or, with an empty answer, clears) the answer to that card's question.
    answer(key: string, entry: { question: string; kind: string; answer: string }): Promise<void>
    // "Otra": the next question for that card (not once it has an answer).
    skip(key: string): Promise<void>
    onChange(listener: (state: QotdState) => void): () => void
  }
  reminders: {
    load(): Promise<Reminder[]>
    // null if it couldn't be made (a missing title, day or time, or too many).
    create(
      input: ReminderInput & { title: string; date: string; time: string }
    ): Promise<Reminder | null>
    // Changing the day, time or repeat starts it over: it rings at its new time.
    update(id: string, patch: ReminderInput): Promise<void>
    // Returns what was removed, to put back with restore() (Deshacer).
    remove(ids: string[]): Promise<Reminder[]>
    restore(reminders: Reminder[]): Promise<void>
    snooze(id: string, minutes: number): Promise<void>
    dismiss(id: string): Promise<void> // "Listo": hides "Posponer" after it rang
    onChange(listener: (reminders: Reminder[]) => void): () => void
  }
  notes: {
    load(): Promise<Note[]>
    create(input?: { text?: string }): Promise<Note>
    // Several at once (Brain Dump); returns them, so they can be undone.
    createMany(inputs: Array<{ text: string }>): Promise<Note[]>
    update(id: string, patch: { text: string }): Promise<void>
    // Returns what was removed, to put back with restore() (Deshacer).
    remove(ids: string[]): Promise<Note[]>
    restore(notes: Note[]): Promise<void>
    onChange(listener: (notes: Note[]) => void): () => void
  }
  voice: {
    // Starts the system's dictation in the focused text field (macOS).
    dictate(): Promise<void>
    // Opens the system settings where dictation is turned on.
    openDictationSettings(): Promise<void>
    // The installed system voices, with their quality (Mac; [] elsewhere).
    voices(fresh?: boolean): Promise<SystemVoice[]>
    // Dip's answer as audio (WAV) in that voice; null if it can't (or a newer one came).
    synthesize(request: { text: string; voice?: string; wpm: number }): Promise<Uint8Array | null>
    stop(): Promise<void>
    // Where better voices are downloaded (Accessibility → Spoken Content).
    openVoiceSettings(): Promise<void>
    // --- Call mode ---
    // macOS microphone permission (asked only once, after explaining why).
    micAccess(): Promise<'granted' | 'denied' | 'not-determined'>
    askMic(): Promise<boolean>
    // Privacy & Security → Microphone, when it was turned down.
    openMicSettings(): Promise<void>
    // One thing the user said (WAV) → text.
    transcribe(wav: Uint8Array, lang?: 'es' | 'en' | 'auto'): Promise<TranscribeResult>
    sttStatus(): Promise<SttStatus>
    // Gets whisper ready while the call starts (its first run is slow).
    warmUpStt(): Promise<void>
    downloadModel(): Promise<void>
    onModelDownload(listener: (progress: ModelDownload) => void): () => void
  }
  images: {
    // Lets the person choose pictures; they are copied into Nuggit's data folder and
    // returned by name (shown as nuggit-img://image/<name>).
    pick(multiple?: boolean): Promise<string[]>
    // Deletes copies that nothing uses anymore.
    forget(names: string[]): Promise<void>
  }
  calendar: {
    status(): Promise<CalendarStatus>
    onStatus(listener: (status: CalendarStatus) => void): () => void
    // Events of the chosen Mac calendars between two dates (YYYY-MM-DD, inclusive).
    events(from: string, to: string): Promise<CalendarEvent[]>
    // The Mac's calendars, to choose which ones to show. Asks macOS the first time.
    listAppleCalendars(): Promise<{ ok: true; calendars: string[] } | { ok: false; error: string }>
    syncNow(): Promise<void>
    // Paso 1: save a .ics file (for Google Calendar, or any calendar app).
    exportIcs(): Promise<{ ok: boolean; path?: string }>
    // Paso 1: turn on the feed and open the Mac's Calendar to subscribe to it.
    subscribe(): Promise<void>
    // Changes in the Mac's calendar: the view reloads its events.
    onChange(listener: () => void): () => void
  }
  music: {
    // details: false only checks Spotify is open (never asks macOS for permission).
    status(details?: boolean): Promise<MusicStatus>
    playPause(): Promise<MusicStatus>
    next(): Promise<MusicStatus>
    // Plays a Spotify link right away ("▶ Probar" in Ajustes). Says why if it can't.
    play(link: string): Promise<{ ok: boolean; error?: string }>
    openSpotify(): Promise<void>
    previous(): Promise<MusicStatus>
    setVolume(volume: number): Promise<MusicStatus>
    // Saves a playlist by its link (its name and picture come from Spotify).
    addPlaylist(link: string): Promise<{ ok: boolean; error?: string }>
    removePlaylist(uri: string): Promise<void>
  }
  focus: {
    load(): Promise<FocusState>
    // Starts a focus round (on that task, or Next Action's).
    start(taskId?: string | null): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    // Back to idle (also skips a break).
    cancel(): Promise<void>
    // Works while running too: the current phase gets the new length.
    setPreset(preset: FocusPreset): Promise<void>
    setTask(taskId: string | null): Promise<void>
    onChange(listener: (state: FocusState) => void): () => void
  }
  popover: {
    // Closes the calling menu bar window (Dip's mini chat or the quick pickup).
    hide(): void
    // False if the chosen global shortcut is taken by another app.
    shortcutWorks(): Promise<boolean>
  }
  app: {
    // Brings up the main window with Settings open (works from detached widgets too).
    openSettings(): void
    onOpenSettings(listener: () => void): () => void
    // Brings up the main window on that tab (e.g. Dip, from "Platicar con Dip").
    openTab(tab: AppTab): void
    info(): Promise<AppInfo>
    // "Abrir Nuggit al iniciar la Mac".
    setOpenAtLogin(open: boolean): Promise<AppInfo>
  }
  // Fase 15: a newer Nuggit Release on GitHub.
  updates: {
    pending(): Promise<UpdateInfo | null>
    dismiss(): Promise<void> // "Ahora no": not again for this version until Nuggit restarts
    open(): Promise<void> // "Descargar": the Release page in the browser
    onAvailable(listener: (update: UpdateInfo) => void): () => void
  }
  // Fase 13: the font families installed on this Mac (empty if they can't be read).
  fonts: {
    list(): Promise<string[]>
  }
  widgetWindows: {
    // rect is relative to the calling window's content area.
    detach(id: string, rect: WidgetRect): Promise<void>
    attach(id: string): Promise<void>
    // Turning on "Pin on top" or "Pin on back" for a widget on the board detaches it first.
    // The two can't be on together: turning one on turns the other off.
    setOptions(id: string, options: DetachedWindowOptions): Promise<void>
    // Quick pickup: a new widget straight onto the computer's desktop.
    open(widget: { type: string; config: unknown; size: { w: number; h: number } }): Promise<void>
    // Quick pickup: bring a widget to the front (its window, or the board), or close it
    // (a detached one goes back to the board; one on the board is hidden).
    focus(id: string): Promise<void>
    close(id: string): Promise<void>
    // "Pin on back" widgets take no clicks: "Editar" brings one up for a moment, and
    // finishEditBack (or a click elsewhere) sends it back to the bottom.
    editBack(id: string): Promise<void>
    finishEditBack(id: string): Promise<void>
    // Size limits for the calling detached window.
    setSizeLimits(min?: { w: number; h: number }, max?: { w: number; h: number }): void
  }
}
