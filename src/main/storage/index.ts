import type {
  Breakpoint,
  DesktopState,
  LayoutEntry,
  Settings,
  WidgetInstance
} from '../../shared/types'
import { readJson, writeJson } from './jsonStore'

const BREAKPOINTS: Breakpoint[] = ['lg', 'md', 'sm']

const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'none', shareTasksWithAI: false },
  theme: 'system'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLayoutEntry(value: unknown): value is LayoutEntry {
  return (
    isObject(value) &&
    typeof value.i === 'string' &&
    ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(value[k]))
  )
}

function isWidgetInstance(value: unknown): value is WidgetInstance {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.hidden === 'boolean'
  )
}

function isDesktopState(value: unknown): value is DesktopState {
  if (!isObject(value) || !Array.isArray(value.widgets) || !isObject(value.layouts)) return false
  const layouts = value.layouts
  return (
    value.widgets.every(isWidgetInstance) &&
    BREAKPOINTS.every((bp) => Array.isArray(layouts[bp]) && layouts[bp].every(isLayoutEntry))
  )
}

// --- Desktop ---

export async function loadDesktop(): Promise<DesktopState | null> {
  const data = await readJson<unknown>('desktop', null)
  return isDesktopState(data) ? data : null
}

export async function saveDesktop(state: unknown): Promise<void> {
  if (!isDesktopState(state)) throw new Error('Invalid desktop state')
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
