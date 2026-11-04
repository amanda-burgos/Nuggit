import type {
  Background,
  DetachedWidget,
  SavedPlaylist,
  SavedDesktop,
  Settings,
  Task,
  WidgetInstance,
  WidgetRect
} from '../../shared/types'
import {
  DEFAULT_FONT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  WIDGET_RADIUS_MAX,
  WIDGET_RADIUS_MIN
} from '../../shared/types'
import { spotifyUri } from '../../shared/music'
import { isLang } from '../../shared/i18n'
import { readJson, writeJson } from './jsonStore'

const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'auto', shareTasksWithAI: false },
  theme: 'system',
  statusIndicator: 'dot',
  dipTray: { visible: true, shortcut: '' },
  pickupTray: 'icon',
  voice: { speak: false, rate: 1, pitch: 1 },
  calendar: { feed: false, apple: false, showCalendars: [], writeToApple: true, autoSync: true },
  music: { enabled: false, onBreak: 'pause', playlists: [] },
  appearance: {
    accent: 'lavender',
    board: { kind: 'default' },
    boardOpacity: 1,
    boardEverywhere: false,
    widgetBackground: { kind: 'default' },
    widgetShadow: true,
    widgetOpacity: 1,
    widgetRadius: 18,
    font: DEFAULT_FONT,
    fontScale: 1,
    fontAuto: true
  },
  ui: { tab: 'home', sidebarCollapsed: false, panels: {} },
  onboarding: { tourDone: false, whatsNew: true },
  qotdTopics: [],
  qotdCustomTopics: []
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// The three old corner choices, kept so settings saved before the slider look the same.
const OLD_CORNERS: Record<string, number> = { square: 6, soft: 18, round: 28 }

export function clampRadius(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(WIDGET_RADIUS_MAX, Math.max(WIDGET_RADIUS_MIN, Math.round(value)))
}

// Fase 13: a font choice is a short id ("nunito") or "mac:<family>"; null if it isn't one.
export function cleanFont(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const font = value.trim()
  if (!font || font.length > 120 || /["\\;{}<>]/.test(font)) return null
  if (font.startsWith('mac:')) return font.length > 4 ? font : null
  return /^[a-z0-9-]+$/.test(font) ? font : null
}

function clampScale(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(value * 100) / 100))
}

function loadAppearance(saved: unknown): Settings['appearance'] {
  if (!isObject(saved)) return { ...DEFAULT_SETTINGS.appearance }
  const { widgetCorners, ...rest } = saved
  const appearance = { ...DEFAULT_SETTINGS.appearance, ...rest } as Settings['appearance']
  const radius = clampRadius(saved.widgetRadius) ?? OLD_CORNERS[widgetCorners as string] ?? null
  if (radius !== null) appearance.widgetRadius = radius
  if (typeof appearance.themeColor !== 'string' || !HEX.test(appearance.themeColor)) {
    delete appearance.themeColor
  }
  appearance.font = cleanFont(saved.font) ?? DEFAULT_FONT
  const heading = cleanFont(saved.headingFont)
  if (heading) appearance.headingFont = heading
  else delete appearance.headingFont
  appearance.fontScale = clampScale(saved.fontScale) ?? 1
  if (typeof appearance.fontAuto !== 'boolean') appearance.fontAuto = true
  return appearance
}

function isRect(value: unknown): value is WidgetRect {
  return isObject(value) && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(value[k]))
}

function isWidgetInstance(value: unknown): value is WidgetInstance {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.hidden === 'boolean'
  )
}

function isDetachedWidget(value: unknown): value is DetachedWidget {
  return (
    isObject(value) &&
    isRect(value.bounds) &&
    typeof value.alwaysOnTop === 'boolean' &&
    ['boolean', 'undefined'].includes(typeof value.allSpaces) &&
    ['boolean', 'undefined'].includes(typeof value.pinBack) &&
    ['boolean', 'undefined'].includes(typeof value.shadow)
  )
}

// Accepts the current format, or an older grid-based file (the renderer converts it).
export function isSavedDesktop(value: unknown): value is SavedDesktop {
  if (!isObject(value) || !Array.isArray(value.widgets)) return false
  if (!value.widgets.every(isWidgetInstance)) return false
  if (isObject(value.positions)) return Object.values(value.positions).every(isRect)
  return isObject(value.layouts)
}

// --- Backgrounds (Fase 9) ---

export const ACCENTS = ['lavender', 'blue', 'mint', 'peach', 'rose', 'sun']
const HEX = /^#[0-9a-f]{6}$/i
// An image copied into the data folder: a generated name, never a path.
export const IMAGE_NAME = /^[0-9a-f-]{36}\.(png|jpe?g|gif|webp|heic|avif)$/i

export function cleanBackground(value: unknown): Background | null {
  if (!isObject(value)) return null
  if (value.kind === 'default') return { kind: 'default' }
  if (value.kind === 'color' && typeof value.color === 'string' && HEX.test(value.color)) {
    return { kind: 'color', color: value.color.toLowerCase() }
  }
  if (value.kind === 'image' && typeof value.image === 'string' && IMAGE_NAME.test(value.image)) {
    return { kind: 'image', image: value.image }
  }
  return null
}

// --- Desktop ---

export async function loadDesktop(): Promise<SavedDesktop | null> {
  const data = await readJson<unknown>('desktop', null)
  if (!isSavedDesktop(data)) return null
  // Keep only valid detached entries that still point to a widget.
  const ids = new Set(data.widgets.map((w) => w.id))
  const detached = Object.fromEntries(
    Object.entries(isObject(data.detached) ? data.detached : {}).filter(
      ([id, entry]) => ids.has(id) && isDetachedWidget(entry)
    )
  )
  return { ...data, detached }
}

export async function saveDesktop(state: unknown): Promise<void> {
  if (!isSavedDesktop(state) || !state.positions) throw new Error('Invalid desktop state')
  await writeJson('desktop', state)
}

// --- Tasks ---

const PRIORITIES = ['low', 'medium', 'high']
const STATUSES = ['todo', 'doing', 'done']

function isOptional(value: unknown, type: 'string' | 'number'): boolean {
  return value === undefined || typeof value === type
}

export function isTask(value: unknown): value is Task {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    PRIORITIES.includes(value.priority as string) &&
    STATUSES.includes(value.status as string) &&
    Number.isFinite(value.order) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    isOptional(value.parentId, 'string') &&
    isOptional(value.dailyId, 'string') &&
    isOptional(value.dueDate, 'string') &&
    isOptional(value.estimateMin, 'number') &&
    isOptional(value.category, 'string') &&
    isOptional(value.description, 'string') &&
    isOptional(value.notes, 'string') &&
    isOptional(value.completedAt, 'string')
  )
}

// tasks.json holds { version, tasks }. Invalid entries are skipped, never crash the app.
export async function loadTasks(): Promise<Task[]> {
  const data = await readJson<unknown>('tasks', null)
  if (!isObject(data) || !Array.isArray(data.tasks)) return []
  return data.tasks.filter(isTask)
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await writeJson('tasks', { version: 1, tasks })
}

// --- Settings ---

const STATUS_INDICATORS = ['dot', 'dot-title', 'title', 'off']
// Gemini ids look like "gemini-flash-latest"; Ollama ones like "llama3.2:3b" or "user/model".
export const MAX_PERSONALITY = 1500
const SETTINGS_TABS = [
  'general',
  'appearance',
  'dip',
  'ai',
  'voice',
  'calendar',
  'music',
  'menubar',
  'about'
]
const TABS = [
  'home',
  'dip',
  'tasks',
  'next',
  'tenders',
  'dailies',
  'notes',
  'brainDump',
  'focus',
  'calendar',
  'music',
  'qotd',
  'reminders',
  'help',
  'settings'
]
const PICKUP_MODES = ['icon', 'menu', 'off']
const SHORTCUTS = ['', 'Alt+Space', 'Control+Alt+Space', 'Command+Shift+Space']
const MODEL_ID = /^[a-z0-9][a-z0-9._:/-]{0,99}$/i
const BACKENDS = ['gemini', 'ollama', 'custom'] as const
const MAX_SERVERS = 5

// A server's base URL: http or https only, without the trailing slash.
function cleanServerUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null // keys go in the key field, not the URL
    return url.toString().replace(/\/+$/, '').slice(0, 300)
  } catch {
    return null
  }
}

function cleanCustomServer(value: unknown): Settings['ai']['custom'] | null {
  if (!isObject(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 60) : ''
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  const servers = (Array.isArray(value.servers) ? value.servers : [])
    .map(cleanServerUrl)
    .filter((url): url is string => Boolean(url))
  const unique = [...new Set(servers)].slice(0, MAX_SERVERS)
  if (!MODEL_ID.test(model) || unique.length === 0) return null
  return { name: name || 'Mi servidor', model, servers: unique }
}

// Every backend once, in the given order; missing ones go at the end.
function cleanOrder(value: unknown): Settings['ai']['order'] | null {
  if (!Array.isArray(value)) return null
  const given = value.filter((b): b is (typeof BACKENDS)[number] =>
    (BACKENDS as readonly string[]).includes(b)
  )
  const order = [...new Set(given)]
  return [...order, ...BACKENDS.filter((b) => !order.includes(b))]
}

// Topics you wrote yourself for the question of the day: { id: "mi-…", label }.
function cleanCustomTopics(value: unknown): Settings['qotdCustomTopics'] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const topics: Settings['qotdCustomTopics'] = []
  for (const item of value) {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.label !== 'string') continue
    const label = item.label.trim().slice(0, 40)
    if (!/^mi-[a-z0-9-]{1,30}$/.test(item.id) || !label || seen.has(item.id)) continue
    seen.add(item.id)
    topics.push({ id: item.id, label })
  }
  return topics.slice(0, 20)
}

// QOTD: the general (random) question became a topic you can turn off ('general'). Someone
// who had already picked topics keeps the general one too and skips "choose at least 1".
function loadQotdTopics(data: Record<string, unknown>): Pick<Settings, 'qotdTopics' | 'qotdSetup'> {
  const topics = cleanTopics(data.qotdTopics) ?? []
  if (typeof data.qotdSetup === 'boolean') return { qotdTopics: topics, qotdSetup: data.qotdSetup }
  if (topics.length)
    return { qotdTopics: ['general', ...topics.filter((t) => t !== 'general')], qotdSetup: true }
  return { qotdTopics: topics }
}

// Topic ids for the question of the day (the renderer ignores ones it doesn't know).
function cleanTopics(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.filter((v): v is string => typeof v === 'string' && /^[a-z0-9-]{1,30}$/.test(v))
  return [...new Set(ids)].slice(0, 30)
}

export async function loadSettings(): Promise<Settings> {
  const data = await readJson<Partial<Settings>>('settings', {})
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    ai: { ...DEFAULT_SETTINGS.ai, ...(isObject(data.ai) ? data.ai : {}) },
    dipTray: { ...DEFAULT_SETTINGS.dipTray, ...(isObject(data.dipTray) ? data.dipTray : {}) },
    voice: { ...DEFAULT_SETTINGS.voice, ...(isObject(data.voice) ? data.voice : {}) },
    calendar: { ...DEFAULT_SETTINGS.calendar, ...(isObject(data.calendar) ? data.calendar : {}) },
    music: { ...DEFAULT_SETTINGS.music, ...(isObject(data.music) ? data.music : {}) },
    appearance: loadAppearance(data.appearance),
    onboarding: {
      ...DEFAULT_SETTINGS.onboarding,
      ...(isObject(data.onboarding) ? data.onboarding : {})
    },
    ...loadQotdTopics(data),
    qotdCustomTopics: cleanCustomTopics(data.qotdCustomTopics) ?? [],
    ...(isLang(data.language) && { language: data.language }),
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(isObject(data.ui) ? data.ui : {}),
      panels: isObject(data.ui) && isObject(data.ui.panels) ? data.ui.panels : {}
    }
  }
}

export async function updateSettings(patch: unknown): Promise<Settings> {
  const current = await loadSettings()
  if (isObject(patch) && ['light', 'dark', 'system'].includes(patch.theme as string)) {
    current.theme = patch.theme as Settings['theme']
  }
  if (isObject(patch) && STATUS_INDICATORS.includes(patch.statusIndicator as string)) {
    current.statusIndicator = patch.statusIndicator as Settings['statusIndicator']
  }
  if (isObject(patch) && typeof patch.dipPersonality === 'string' && patch.dipPersonality.trim()) {
    current.dipPersonality = patch.dipPersonality.trim().slice(0, MAX_PERSONALITY)
  } else if (isObject(patch) && (patch.dipPersonality === null || patch.dipPersonality === '')) {
    delete current.dipPersonality
  }
  if (isObject(patch) && isObject(patch.dipTray)) {
    const { visible, shortcut } = patch.dipTray
    if (typeof visible === 'boolean') current.dipTray.visible = visible
    if (SHORTCUTS.includes(shortcut as string)) {
      current.dipTray.shortcut = shortcut as Settings['dipTray']['shortcut']
    }
  }
  if (isObject(patch) && isObject(patch.voice)) {
    const { speak, voiceURI, rate, pitch, stt, whisperModel, callLang } = patch.voice
    if (typeof speak === 'boolean') current.voice.speak = speak
    if (typeof voiceURI === 'string' && voiceURI.trim()) {
      current.voice.voiceURI = voiceURI.trim().slice(0, 300)
    } else if (voiceURI === null || voiceURI === '') delete current.voice.voiceURI
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      current.voice.rate = Math.min(2, Math.max(0.5, Math.round(rate * 10) / 10))
    }
    if (typeof pitch === 'number' && Number.isFinite(pitch)) {
      current.voice.pitch = Math.min(1.25, Math.max(0.8, Math.round(pitch * 100) / 100))
    }
    if (['auto', 'whisper', 'custom', 'gemini'].includes(stt as string)) {
      current.voice.stt = stt as Settings['voice']['stt']
    }
    if (whisperModel === 'base' || whisperModel === 'small')
      current.voice.whisperModel = whisperModel
    if (callLang === 'auto' || callLang === 'es' || callLang === 'en')
      current.voice.callLang = callLang
  }
  if (isObject(patch) && isObject(patch.appearance)) {
    const {
      accent,
      board,
      boardOpacity,
      boardEverywhere,
      themeColor,
      widgetBackground,
      widgetShadow,
      widgetOpacity,
      widgetRadius,
      font,
      headingFont,
      fontScale,
      fontAuto
    } = patch.appearance
    if (typeof accent === 'string' && (ACCENTS.includes(accent) || HEX.test(accent))) {
      current.appearance.accent = accent
    }
    const cleanBoard = cleanBackground(board)
    if (cleanBoard) current.appearance.board = cleanBoard
    if (typeof boardOpacity === 'number' && Number.isFinite(boardOpacity)) {
      current.appearance.boardOpacity = Math.min(1, Math.max(0.1, boardOpacity))
    }
    if (typeof boardEverywhere === 'boolean') current.appearance.boardEverywhere = boardEverywhere
    if (typeof themeColor === 'string' && HEX.test(themeColor)) {
      current.appearance.themeColor = themeColor.toLowerCase()
    } else if (themeColor === null) delete current.appearance.themeColor
    const cleanWidgets = cleanBackground(widgetBackground)
    if (cleanWidgets) current.appearance.widgetBackground = cleanWidgets
    if (typeof widgetShadow === 'boolean') current.appearance.widgetShadow = widgetShadow
    if (typeof widgetOpacity === 'number' && Number.isFinite(widgetOpacity)) {
      current.appearance.widgetOpacity = Math.min(1, Math.max(0.6, widgetOpacity))
    }
    const radius = clampRadius(widgetRadius)
    if (radius !== null) current.appearance.widgetRadius = radius
    const cleanText = cleanFont(font)
    if (cleanText) current.appearance.font = cleanText
    const cleanHeading = cleanFont(headingFont)
    if (cleanHeading) current.appearance.headingFont = cleanHeading
    else if (headingFont === null) delete current.appearance.headingFont
    const scale = clampScale(fontScale)
    if (scale !== null) current.appearance.fontScale = scale
    if (typeof fontAuto === 'boolean') current.appearance.fontAuto = fontAuto
  }
  if (isObject(patch) && isObject(patch.music)) {
    const { enabled, onBreak, focusPlaylist, breakPlaylist } = patch.music
    if (typeof enabled === 'boolean') current.music.enabled = enabled
    if (onBreak === 'pause' || onBreak === 'playlist') current.music.onBreak = onBreak
    for (const [key, value] of [
      ['focusPlaylist', focusPlaylist],
      ['breakPlaylist', breakPlaylist]
    ] as const) {
      const uri = typeof value === 'string' ? spotifyUri(value) : null
      if (uri) current.music[key] = uri
      else if (value === null || value === '') delete current.music[key]
    }
    if (Array.isArray(patch.music.playlists)) {
      current.music.playlists = patch.music.playlists
        .filter(
          (p): p is SavedPlaylist =>
            isObject(p) &&
            typeof p.uri === 'string' &&
            spotifyUri(p.uri) === p.uri &&
            typeof p.name === 'string'
        )
        .map((p) => ({
          uri: p.uri,
          name: p.name.slice(0, 120),
          ...(typeof p.image === 'string' && p.image.startsWith('https://')
            ? { image: p.image }
            : {})
        }))
        .slice(0, 20)
    }
  }
  if (isObject(patch) && isObject(patch.calendar)) {
    const { feed, apple, showCalendars, writeToApple, autoSync } = patch.calendar
    if (typeof autoSync === 'boolean') current.calendar.autoSync = autoSync
    if (typeof feed === 'boolean') current.calendar.feed = feed
    if (typeof apple === 'boolean') current.calendar.apple = apple
    if (typeof writeToApple === 'boolean') current.calendar.writeToApple = writeToApple
    if (Array.isArray(showCalendars)) {
      current.calendar.showCalendars = [
        ...new Set(
          showCalendars.filter((n): n is string => typeof n === 'string' && n.length < 200)
        )
      ].slice(0, 50)
    }
  }
  if (isObject(patch) && PICKUP_MODES.includes(patch.musicTray as string)) {
    current.musicTray = patch.musicTray as Settings['musicTray']
  }
  if (isObject(patch) && PICKUP_MODES.includes(patch.pickupTray as string)) {
    current.pickupTray = patch.pickupTray as Settings['pickupTray']
  }
  if (isObject(patch) && isObject(patch.ui)) {
    const { tab, sidebarCollapsed, panel } = patch.ui
    if (TABS.includes(tab as string)) current.ui.tab = tab as Settings['ui']['tab']
    if (SETTINGS_TABS.includes(patch.ui.settingsTab as string)) {
      current.ui.settingsTab = patch.ui.settingsTab as Settings['ui']['settingsTab']
    }
    if (typeof sidebarCollapsed === 'boolean') current.ui.sidebarCollapsed = sidebarCollapsed
    if (isObject(panel) && typeof panel.type === 'string' && isObject(panel.config)) {
      current.ui.panels = { ...current.ui.panels, [panel.type]: panel.config }
    }
  }
  if (isObject(patch)) {
    const topics = cleanTopics(patch.qotdTopics)
    if (topics) current.qotdTopics = topics
    if (typeof patch.qotdSetup === 'boolean') current.qotdSetup = patch.qotdSetup
    const custom = cleanCustomTopics(patch.qotdCustomTopics)
    if (custom) current.qotdCustomTopics = custom
    if (isLang(patch.language)) current.language = patch.language
  }
  if (isObject(patch) && isObject(patch.onboarding)) {
    const { tourDone, whatsNew, lastSeenVersion, lastSeenNews } = patch.onboarding
    if (typeof tourDone === 'boolean') current.onboarding.tourDone = tourDone
    if (typeof whatsNew === 'boolean') current.onboarding.whatsNew = whatsNew
    if (typeof lastSeenVersion === 'string' && lastSeenVersion.length <= 40) {
      current.onboarding.lastSeenVersion = lastSeenVersion
    }
    if (typeof lastSeenNews === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lastSeenNews)) {
      current.onboarding.lastSeenNews = lastSeenNews
    }
  }
  if (isObject(patch) && isObject(patch.ai)) {
    const { shareTasksWithAI } = patch.ai
    for (const key of ['model', 'ollamaModel'] as const) {
      const value = patch.ai[key]
      if (typeof value === 'string' && MODEL_ID.test(value.trim())) current.ai[key] = value.trim()
      else if (value === null || value === '') delete current.ai[key]
    }
    if (typeof shareTasksWithAI === 'boolean') current.ai.shareTasksWithAI = shareTasksWithAI
    if (patch.ai.custom === null) delete current.ai.custom
    else if (patch.ai.custom !== undefined) {
      const custom = cleanCustomServer(patch.ai.custom)
      if (custom) current.ai.custom = custom
    }
    const order = cleanOrder(patch.ai.order)
    if (order) current.ai.order = order
  }
  await writeJson('settings', current)
  return current
}

// Only the main process sets the provider, when a key is saved or removed.
export async function setAIProvider(provider: Settings['ai']['provider']): Promise<Settings> {
  const current = await loadSettings()
  current.ai.provider = provider
  await writeJson('settings', current)
  return current
}
