import { ipcMain } from 'electron'
import type { DetachedWindowOptions, WidgetRect } from '../shared/types'
import { getDesktop, replaceDesktop, updateWidgetConfig } from './desktop'
import * as ai from './ai'
import { clearDipChat, getDipChat, retryDip, sendToDip } from './dipChat'
import { changeSettings } from './settings'
import { loadSettings } from './storage'
import { createTask, getTasks, removeTask, restoreTasks, updateTask } from './tasks'
import {
  attachWidget,
  detachWidget,
  setAllVisible,
  setWindowOptions,
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

interface IpcDeps {
  openSettings(): void
}

export function registerIpc({ openSettings }: IpcDeps): void {
  ipcMain.handle('desktop:load', () => getDesktop())
  ipcMain.handle('desktop:save', (event, state: unknown) => replaceDesktop(state, event.sender))
  ipcMain.handle('desktop:updateConfig', (_event, id: unknown, patch: unknown) => {
    if (typeof id === 'string' && isObject(patch)) updateWidgetConfig(id, patch)
  })

  ipcMain.handle('tasks:load', () => getTasks())
  ipcMain.handle('tasks:create', (_event, input: unknown) => createTask(input))
  ipcMain.handle('tasks:update', (_event, id: unknown, patch: unknown) => {
    if (typeof id === 'string') updateTask(id, patch)
  })
  ipcMain.handle('tasks:remove', (_event, id: unknown) =>
    typeof id === 'string' ? removeTask(id) : []
  )
  ipcMain.handle('tasks:restore', (_event, tasks: unknown) => restoreTasks(tasks))

  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:update', (_event, patch: unknown) => changeSettings(patch))

  ipcMain.handle('ai:saveKey', (_event, key: unknown) => ai.saveKey(key))
  ipcMain.handle('ai:removeKey', () => ai.removeKey())
  ipcMain.handle('ai:setProvider', (_event, provider: unknown) => ai.setProvider(provider))
  ipcMain.handle('ai:test', () => ai.testConnection())
  ipcMain.handle('ai:status', () => ai.getStatus())
  ipcMain.handle('ai:chat', (_event, messages: unknown) => ai.chat(messages))
  ipcMain.handle('ai:proposePersonality', (_event, messages: unknown) =>
    ai.proposePersonality(messages)
  )

  ipcMain.handle('dipChat:load', () => getDipChat())
  ipcMain.handle('dipChat:send', (_event, text: unknown) => sendToDip(text))
  ipcMain.handle('dipChat:retry', () => retryDip())
  ipcMain.handle('dipChat:clear', () => clearDipChat())

  ipcMain.on('app:openSettings', () => openSettings())

  ipcMain.handle('widgetWindows:detach', (event, id: unknown, rect: unknown) => {
    if (typeof id === 'string' && isRect(rect)) detachWidget(id, rect, event.sender)
  })
  ipcMain.handle('widgetWindows:attach', (_event, id: unknown) => {
    if (typeof id === 'string') attachWidget(id)
  })
  ipcMain.handle('widgetWindows:setOptions', (_event, id: unknown, options: unknown) => {
    if (typeof id !== 'string' || !isObject(options)) return
    const valid: DetachedWindowOptions = {}
    if (typeof options.alwaysOnTop === 'boolean') valid.alwaysOnTop = options.alwaysOnTop
    if (typeof options.shadow === 'boolean') valid.shadow = options.shadow
    setWindowOptions(id, valid)
  })
  ipcMain.handle('widgetWindows:setAllVisible', (_event, visible: unknown) => {
    if (typeof visible === 'boolean') setAllVisible(visible)
  })
  ipcMain.on('widgetWindows:setSizeLimits', (event, min: unknown, max: unknown) => {
    setSizeLimits(event.sender, isSize(min) ? min : undefined, isSize(max) ? max : undefined)
  })
}
