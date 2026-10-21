import { app, BrowserWindow, ipcMain } from 'electron'
import { getMusicStatus, nextTrack, openSpotify, playLink, playPause } from './music'
import { downloadModel, getSttStatus, transcribe, warmUpStt } from './stt'
import {
  askMic,
  dictate,
  listVoices,
  micAccess,
  openMicSettings,
  openDictationSettings,
  openVoiceSettings,
  stopVoice,
  synthesize
} from './voice'
import type { AppInfo, DetachedWindowOptions, WidgetRect } from '../shared/types'
import { getDesktop, replaceDesktop, setWidgetLocked, updateWidgetConfig } from './desktop'
import * as ai from './ai'
import { splitBrainDump } from './ai/brainDump'
import { dailyQuestions, proposeDailies } from './ai/dailies'
import { proposeTenders, tenderQuestions } from './ai/tenders'
import { createDailies, createDaily, getDailies, removeDailies, updateDaily } from './dailies'
import {
  applyAction,
  cancelAction,
  clearDipChat,
  getDipChat,
  retryDip,
  sendToDip,
  undoAction
} from './dipChat'
import { dipShortcutWorks } from './dipTray'
import {
  exportIcs,
  getCalendarStatus,
  getEvents,
  listAppleCalendars,
  subscribe,
  syncNow
} from './calendar'
import {
  cancelFocus,
  getFocus,
  pauseFocus,
  resumeFocus,
  setFocusPreset,
  setFocusTask,
  setLockdown,
  startFocus
} from './focus'
import { createNote, createNotes, getNotes, removeNotes, restoreNotes, updateNote } from './notes'
import { getNextActionState, setAvailable, skipAction, startAction, tinyStep } from './nextAction'
import { changeSettings } from './settings'
import { loadSettings } from './storage'
import {
  completeTask,
  createTask,
  createTaskWithSteps,
  getTasks,
  removeTask,
  restoreTasks,
  setStatuses,
  updateTask
} from './tasks'
import {
  attachWidget,
  closeWidget,
  detachWidget,
  finishEditingBack,
  focusWidget,
  openWidget,
  setAllVisible,
  setWindowOptions,
  setSizeLimits,
  startEditingBack
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
  openBoard(): void // the main window, on the Inicio tab
}

function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    dataPath: app.getPath('userData'),
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    packaged: app.isPackaged
  }
}

export function registerIpc({ openSettings, openBoard }: IpcDeps): void {
  ipcMain.handle('desktop:load', () => getDesktop())
  ipcMain.handle('desktop:save', (event, state: unknown) => replaceDesktop(state, event.sender))
  ipcMain.handle('desktop:updateConfig', (_event, id: unknown, patch: unknown) => {
    if (typeof id === 'string' && isObject(patch)) updateWidgetConfig(id, patch)
  })
  ipcMain.handle('desktop:setLocked', (_event, id: unknown, locked: unknown) => {
    if (typeof id === 'string' && typeof locked === 'boolean') setWidgetLocked(id, locked)
  })

  ipcMain.handle('tasks:load', () => getTasks())
  ipcMain.handle('tasks:create', (_event, input: unknown) => createTask(input))
  ipcMain.handle('tasks:update', (_event, id: unknown, patch: unknown) => {
    if (typeof id === 'string') updateTask(id, patch)
  })
  ipcMain.handle('tasks:remove', (_event, id: unknown) =>
    typeof id === 'string' ? removeTask(id) : []
  )
  ipcMain.handle('tasks:createWithSteps', (_event, input: unknown) => createTaskWithSteps(input))
  ipcMain.handle('tasks:restore', (_event, tasks: unknown) => restoreTasks(tasks))
  ipcMain.handle('tasks:complete', (_event, id: unknown) =>
    typeof id === 'string' ? completeTask(id) : []
  )
  ipcMain.handle('tasks:restoreStatuses', (_event, changes: unknown) => setStatuses(changes))

  ipcMain.handle('nextAction:load', () => getNextActionState())
  ipcMain.handle('nextAction:setAvailable', (_event, minutes: unknown) => setAvailable(minutes))
  ipcMain.handle('nextAction:skip', (_event, id: unknown) => skipAction(id))
  ipcMain.handle('nextAction:start', (_event, id: unknown) => startAction(id))
  ipcMain.handle('nextAction:tinyStep', (_event, id: unknown) => tinyStep(id))

  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:update', async (_event, patch: unknown) => {
    const settings = await changeSettings(patch)
    // A new server, model or order changes what Dip can use right now.
    if (isObject(patch) && isObject(patch.ai)) ai.refreshStatus().catch(() => undefined)
    return settings
  })

  ipcMain.handle('ai:saveKey', (_event, key: unknown) => ai.saveKey(key))
  ipcMain.handle('ai:removeKey', () => ai.removeKey())
  ipcMain.handle('ai:saveServerKey', (_event, key: unknown) => ai.saveServerKey(key))
  ipcMain.handle('ai:removeServerKey', () => ai.removeServerKey())
  ipcMain.handle('ai:setProvider', (_event, provider: unknown) => ai.setProvider(provider))
  ipcMain.handle('ai:test', () => ai.testConnection())
  ipcMain.handle('ai:status', () => ai.getStatus())
  ipcMain.handle('ai:agents', () => ai.agentsInfo())
  ipcMain.handle('ai:chat', (_event, messages: unknown) => ai.chat(messages))
  ipcMain.handle('ai:tenderQuestions', (_event, task: unknown) => tenderQuestions(task))
  ipcMain.handle('ai:proposeTenders', (_event, request: unknown) => proposeTenders(request))
  ipcMain.handle('ai:dailyQuestions', (_event, request: unknown) => dailyQuestions(request))
  ipcMain.handle('ai:proposeDailies', (_event, request: unknown) => proposeDailies(request))

  ipcMain.handle('dailies:load', () => getDailies())
  ipcMain.handle('dailies:create', (_event, input: unknown) => createDaily(input))
  ipcMain.handle('dailies:createMany', (_event, inputs: unknown) => createDailies(inputs))
  ipcMain.handle('dailies:update', (_event, id: unknown, patch: unknown) => updateDaily(id, patch))
  ipcMain.handle('dailies:remove', (_event, ids: unknown) => removeDailies(ids))

  ipcMain.handle('notes:load', () => getNotes())
  ipcMain.handle('notes:create', (_event, input: unknown) => createNote(input))
  ipcMain.handle('notes:createMany', (_event, inputs: unknown) => createNotes(inputs))
  ipcMain.handle('notes:update', (_event, id: unknown, patch: unknown) => updateNote(id, patch))
  ipcMain.handle('notes:remove', (_event, ids: unknown) => removeNotes(ids))
  ipcMain.handle('notes:restore', (_event, notes: unknown) => restoreNotes(notes))
  ipcMain.handle('voice:dictate', (event) => dictate(event.sender))
  ipcMain.handle('voice:openDictationSettings', () => openDictationSettings())
  ipcMain.handle('voice:voices', (_event, fresh: unknown) => listVoices(fresh === true))
  ipcMain.handle('voice:synthesize', (_event, request: unknown) => synthesize(request))
  ipcMain.handle('voice:stop', () => stopVoice())
  ipcMain.handle('voice:openVoiceSettings', () => openVoiceSettings())
  ipcMain.handle('voice:micAccess', () => micAccess())
  ipcMain.handle('voice:askMic', () => askMic())
  ipcMain.handle('voice:openMicSettings', () => openMicSettings())
  ipcMain.handle('stt:transcribe', (_event, wav: unknown, lang: unknown) => transcribe(wav, lang))
  ipcMain.handle('stt:status', () => getSttStatus())
  ipcMain.handle('stt:warmUp', () => warmUpStt())
  ipcMain.handle('stt:downloadModel', () => downloadModel())
  ipcMain.handle('calendar:status', () => getCalendarStatus())
  ipcMain.handle('calendar:events', (_event, from: unknown, to: unknown) => getEvents(from, to))
  ipcMain.handle('calendar:listAppleCalendars', () => listAppleCalendars())
  ipcMain.handle('calendar:syncNow', () => syncNow())
  ipcMain.handle('calendar:exportIcs', () => exportIcs())
  ipcMain.handle('calendar:subscribe', () => subscribe())
  ipcMain.handle('music:status', (_event, details: unknown) => getMusicStatus(details !== false))
  ipcMain.handle('music:playPause', () => playPause())
  ipcMain.handle('music:next', () => nextTrack())
  ipcMain.handle('music:play', (_event, link: unknown) => playLink(link))
  ipcMain.handle('music:openSpotify', () => openSpotify())
  ipcMain.handle('focus:load', () => getFocus())
  ipcMain.handle('focus:start', (_event, taskId: unknown) => startFocus(taskId))
  ipcMain.handle('focus:pause', () => pauseFocus())
  ipcMain.handle('focus:resume', () => resumeFocus())
  ipcMain.handle('focus:cancel', () => cancelFocus())
  ipcMain.handle('focus:setPreset', (_event, preset: unknown) => setFocusPreset(preset))
  ipcMain.handle('focus:setTask', (_event, taskId: unknown) => setFocusTask(taskId))
  ipcMain.handle('focus:setLockdown', (_event, on: unknown) => setLockdown(on))
  ipcMain.handle('ai:brainDump', (_event, text: unknown) => splitBrainDump(text))
  ipcMain.handle('ai:proposePersonality', (_event, messages: unknown) =>
    ai.proposePersonality(messages)
  )

  ipcMain.handle('dipChat:load', () => getDipChat())
  ipcMain.handle('dipChat:send', (_event, text: unknown, options: unknown) =>
    sendToDip(text, options)
  )
  ipcMain.handle('dipChat:retry', () => retryDip())
  ipcMain.handle('dipChat:clear', () => clearDipChat())
  ipcMain.handle('dipChat:applyAction', (_event, id: unknown, edits: unknown) =>
    applyAction(id, edits)
  )
  ipcMain.handle('dipChat:cancelAction', (_event, id: unknown) => cancelAction(id))
  ipcMain.handle('dipChat:undoAction', (_event, id: unknown) => undoAction(id))

  // Hides whichever menu bar window asked (Dip's mini chat or the quick pickup).
  ipcMain.on('popover:hide', (event) => BrowserWindow.fromWebContents(event.sender)?.hide())
  ipcMain.handle('popover:shortcutWorks', () => dipShortcutWorks())

  ipcMain.on('app:openSettings', () => openSettings())
  ipcMain.handle('app:info', () => appInfo())
  ipcMain.handle('app:setOpenAtLogin', (_event, open: unknown) => {
    if (typeof open === 'boolean') app.setLoginItemSettings({ openAtLogin: open })
    return appInfo()
  })

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
    if (typeof options.allSpaces === 'boolean') valid.allSpaces = options.allSpaces
    if (typeof options.pinBack === 'boolean') valid.pinBack = options.pinBack
    if (typeof options.shadow === 'boolean') valid.shadow = options.shadow
    setWindowOptions(id, valid)
  })
  ipcMain.handle('widgetWindows:open', (_event, widget: unknown) => openWidget(widget))
  ipcMain.handle('widgetWindows:focus', (_event, id: unknown) => {
    if (typeof id === 'string') focusWidget(id, openBoard)
  })
  ipcMain.handle('widgetWindows:editBack', (_event, id: unknown) => {
    if (typeof id === 'string') startEditingBack(id)
  })
  ipcMain.handle('widgetWindows:finishEditBack', (_event, id: unknown) => {
    if (typeof id === 'string') finishEditingBack(id)
  })
  ipcMain.handle('widgetWindows:close', (_event, id: unknown) => {
    if (typeof id === 'string') closeWidget(id)
  })
  ipcMain.handle('widgetWindows:setAllVisible', (_event, visible: unknown) => {
    if (typeof visible === 'boolean') setAllVisible(visible)
  })
  ipcMain.on('widgetWindows:setSizeLimits', (event, min: unknown, max: unknown) => {
    setSizeLimits(event.sender, isSize(min) ? min : undefined, isSize(max) ? max : undefined)
  })
}
