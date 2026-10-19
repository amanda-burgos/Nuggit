import type {
  DetachedWidget,
  SavedDesktop,
  Settings,
  Task,
  WidgetInstance,
  WidgetRect
} from '../../shared/types'
import { readJson, writeJson } from './jsonStore'

const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'auto', shareTasksWithAI: false },
  theme: 'system',
  statusIndicator: 'dot',
  dipTray: { visible: true, shortcut: '' },
  pickupTray: 'icon',
  ui: { tab: 'home', sidebarCollapsed: false, panels: {} }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
const TABS = [
  'home',
  'dip',
  'tasks',
  'next',
  'tenders',
  'dailies',
  'notes',
  'brainDump',
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

export async function loadSettings(): Promise<Settings> {
  const data = await readJson<Partial<Settings>>('settings', {})
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    ai: { ...DEFAULT_SETTINGS.ai, ...(isObject(data.ai) ? data.ai : {}) },
    dipTray: { ...DEFAULT_SETTINGS.dipTray, ...(isObject(data.dipTray) ? data.dipTray : {}) },
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
  if (isObject(patch) && PICKUP_MODES.includes(patch.pickupTray as string)) {
    current.pickupTray = patch.pickupTray as Settings['pickupTray']
  }
  if (isObject(patch) && isObject(patch.ui)) {
    const { tab, sidebarCollapsed, panel } = patch.ui
    if (TABS.includes(tab as string)) current.ui.tab = tab as Settings['ui']['tab']
    if (typeof sidebarCollapsed === 'boolean') current.ui.sidebarCollapsed = sidebarCollapsed
    if (isObject(panel) && typeof panel.type === 'string' && isObject(panel.config)) {
      current.ui.panels = { ...current.ui.panels, [panel.type]: panel.config }
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
