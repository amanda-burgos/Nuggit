import { ipcMain, nativeTheme } from 'electron'
import type { WidgetRect } from '../shared/types'
import { getDesktop, replaceDesktop, updateWidgetConfig } from './desktop'
import { loadSettings, updateSettings } from './storage'
import {
  attachWidget,
  detachWidget,
  setAllVisible,
  setAlwaysOnTop,
  setSizeLimits
} from './widgetWindows'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRect(value: unknown): value is WidgetRect {
  return isObject(value) && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(value[k]))
}

function isSize(value: unknown): value is { w: number; h: number } {
  return isObject(value) && Number.isFinite(value.w) && Number.isFinite(value.h)
}

export function registerIpc(): void {
  ipcMain.handle('desktop:load', () => getDesktop())
  ipcMain.handle('desktop:save', (event, state: unknown) => replaceDesktop(state, event.sender))
  ipcMain.handle('desktop:updateConfig', (_event, id: unknown, patch: unknown) => {
    if (typeof id === 'string' && isObject(patch)) updateWidgetConfig(id, patch)
  })

  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:update', async (_event, patch: unknown) => {
    const settings = await updateSettings(patch)
    // Every window (including detached widgets) follows the theme through the OS setting.
    nativeTheme.themeSource = settings.theme
    return settings
  })

  ipcMain.handle('widgetWindows:detach', (event, id: unknown, rect: unknown) => {
    if (typeof id === 'string' && isRect(rect)) detachWidget(id, rect, event.sender)
  })
  ipcMain.handle('widgetWindows:attach', (_event, id: unknown) => {
    if (typeof id === 'string') attachWidget(id)
  })
  ipcMain.handle('widgetWindows:setAlwaysOnTop', (_event, id: unknown, on: unknown) => {
    if (typeof id === 'string' && typeof on === 'boolean') setAlwaysOnTop(id, on)
  })
  ipcMain.handle('widgetWindows:setAllVisible', (_event, visible: unknown) => {
    if (typeof visible === 'boolean') setAllVisible(visible)
  })
  ipcMain.on('widgetWindows:setSizeLimits', (event, min: unknown, max: unknown) => {
    setSizeLimits(event.sender, isSize(min) ? min : undefined, isSize(max) ? max : undefined)
  })
}
