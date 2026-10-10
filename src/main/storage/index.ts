import type {
  DetachedWidget,
  SavedDesktop,
  Settings,
  WidgetInstance,
  WidgetRect
} from '../../shared/types'
import { readJson, writeJson } from './jsonStore'

const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'none', shareTasksWithAI: false },
  theme: 'system'
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
  return isObject(value) && isRect(value.bounds) && typeof value.alwaysOnTop === 'boolean'
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

// --- Settings ---

export async function loadSettings(): Promise<Settings> {
  const data = await readJson<Partial<Settings>>('settings', {})
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    ai: { ...DEFAULT_SETTINGS.ai, ...(isObject(data.ai) ? data.ai : {}) }
  }
}

export async function updateSettings(patch: unknown): Promise<Settings> {
  const current = await loadSettings()
  if (isObject(patch) && ['light', 'dark', 'system'].includes(patch.theme as string)) {
    current.theme = patch.theme as Settings['theme']
  }
  await writeJson('settings', current)
  return current
}
