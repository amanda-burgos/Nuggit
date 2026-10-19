import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AIStatus,
  Daily,
  DipChatState,
  FocusState,
  NextActionState,
  Note,
  NuggitApi,
  SavedDesktop,
  Settings,
  Task
} from '../shared/types'

// Safe API exposed to the renderer. All disk access goes through the main process.
const api: NuggitApi = {
  desktop: {
    load: () => ipcRenderer.invoke('desktop:load'),
    save: (state) => ipcRenderer.invoke('desktop:save', state),
    updateConfig: (id, patch) => ipcRenderer.invoke('desktop:updateConfig', id, patch),
    setLocked: (id, locked) => ipcRenderer.invoke('desktop:setLocked', id, locked),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: SavedDesktop): void => listener(state)
      ipcRenderer.on('desktop:changed', handler)
      return () => ipcRenderer.removeListener('desktop:changed', handler)
    }
  },
  tasks: {
    load: () => ipcRenderer.invoke('tasks:load'),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
    remove: (id) => ipcRenderer.invoke('tasks:remove', id),
    createWithSteps: (input) => ipcRenderer.invoke('tasks:createWithSteps', input),
    restore: (tasks) => ipcRenderer.invoke('tasks:restore', tasks),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    restoreStatuses: (changes) => ipcRenderer.invoke('tasks:restoreStatuses', changes),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, tasks: Task[]): void => listener(tasks)
      ipcRenderer.on('tasks:changed', handler)
      return () => ipcRenderer.removeListener('tasks:changed', handler)
    }
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, settings: Settings): void => listener(settings)
      ipcRenderer.on('settings:changed', handler)
      return () => ipcRenderer.removeListener('settings:changed', handler)
    }
  },
  ai: {
    saveKey: (key) => ipcRenderer.invoke('ai:saveKey', key),
    removeKey: () => ipcRenderer.invoke('ai:removeKey'),
    saveServerKey: (key) => ipcRenderer.invoke('ai:saveServerKey', key),
    removeServerKey: () => ipcRenderer.invoke('ai:removeServerKey'),
    setProvider: (provider) => ipcRenderer.invoke('ai:setProvider', provider),
    test: () => ipcRenderer.invoke('ai:test'),
    status: () => ipcRenderer.invoke('ai:status'),
    agents: () => ipcRenderer.invoke('ai:agents'),
    onStatusChange: (listener) => {
      const handler = (_event: IpcRendererEvent, status: AIStatus): void => listener(status)
      ipcRenderer.on('ai:status', handler)
      return () => ipcRenderer.removeListener('ai:status', handler)
    },
    chat: (messages) => ipcRenderer.invoke('ai:chat', messages),
    tenderQuestions: (task) => ipcRenderer.invoke('ai:tenderQuestions', task),
    proposeTenders: (request) => ipcRenderer.invoke('ai:proposeTenders', request),
    dailyQuestions: (request) => ipcRenderer.invoke('ai:dailyQuestions', request),
    proposeDailies: (request) => ipcRenderer.invoke('ai:proposeDailies', request),
    proposePersonality: (messages) => ipcRenderer.invoke('ai:proposePersonality', messages),
    brainDump: (text) => ipcRenderer.invoke('ai:brainDump', text)
  },
  dipChat: {
    load: () => ipcRenderer.invoke('dipChat:load'),
    send: (text) => ipcRenderer.invoke('dipChat:send', text),
    retry: () => ipcRenderer.invoke('dipChat:retry'),
    clear: () => ipcRenderer.invoke('dipChat:clear'),
    applyAction: (id, edits) => ipcRenderer.invoke('dipChat:applyAction', id, edits),
    cancelAction: (id) => ipcRenderer.invoke('dipChat:cancelAction', id),
    undoAction: (id) => ipcRenderer.invoke('dipChat:undoAction', id),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: DipChatState): void => listener(state)
      ipcRenderer.on('dipChat:changed', handler)
      return () => ipcRenderer.removeListener('dipChat:changed', handler)
    }
  },
  dailies: {
    load: () => ipcRenderer.invoke('dailies:load'),
    create: (input) => ipcRenderer.invoke('dailies:create', input),
    createMany: (inputs) => ipcRenderer.invoke('dailies:createMany', inputs),
    update: (id, patch) => ipcRenderer.invoke('dailies:update', id, patch),
    remove: (ids) => ipcRenderer.invoke('dailies:remove', ids),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, dailies: Daily[]): void => listener(dailies)
      ipcRenderer.on('dailies:changed', handler)
      return () => ipcRenderer.removeListener('dailies:changed', handler)
    }
  },
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    create: (input) => ipcRenderer.invoke('notes:create', input),
    createMany: (inputs) => ipcRenderer.invoke('notes:createMany', inputs),
    update: (id, patch) => ipcRenderer.invoke('notes:update', id, patch),
    remove: (ids) => ipcRenderer.invoke('notes:remove', ids),
    restore: (notes) => ipcRenderer.invoke('notes:restore', notes),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, notes: Note[]): void => listener(notes)
      ipcRenderer.on('notes:changed', handler)
      return () => ipcRenderer.removeListener('notes:changed', handler)
    }
  },
  voice: {
    dictate: () => ipcRenderer.invoke('voice:dictate'),
    openDictationSettings: () => ipcRenderer.invoke('voice:openDictationSettings'),
    voices: (fresh) => ipcRenderer.invoke('voice:voices', fresh ?? false),
    synthesize: (request) => ipcRenderer.invoke('voice:synthesize', request),
    stop: () => ipcRenderer.invoke('voice:stop'),
    openVoiceSettings: () => ipcRenderer.invoke('voice:openVoiceSettings')
  },
  focus: {
    load: () => ipcRenderer.invoke('focus:load'),
    start: (taskId) => ipcRenderer.invoke('focus:start', taskId ?? null),
    pause: () => ipcRenderer.invoke('focus:pause'),
    resume: () => ipcRenderer.invoke('focus:resume'),
    cancel: () => ipcRenderer.invoke('focus:cancel'),
    setPreset: (preset) => ipcRenderer.invoke('focus:setPreset', preset),
    setTask: (taskId) => ipcRenderer.invoke('focus:setTask', taskId),
    setLockdown: (on) => ipcRenderer.invoke('focus:setLockdown', on),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: FocusState): void => listener(state)
      ipcRenderer.on('focus:changed', handler)
      return () => ipcRenderer.removeListener('focus:changed', handler)
    }
  },
  nextAction: {
    load: () => ipcRenderer.invoke('nextAction:load'),
    setAvailable: (minutes) => ipcRenderer.invoke('nextAction:setAvailable', minutes),
    skip: (id) => ipcRenderer.invoke('nextAction:skip', id),
    start: (id) => ipcRenderer.invoke('nextAction:start', id),
    tinyStep: (id) => ipcRenderer.invoke('nextAction:tinyStep', id),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: NextActionState): void => listener(state)
      ipcRenderer.on('nextAction:changed', handler)
      return () => ipcRenderer.removeListener('nextAction:changed', handler)
    }
  },
  popover: {
    hide: () => ipcRenderer.send('popover:hide'),
    shortcutWorks: () => ipcRenderer.invoke('popover:shortcutWorks')
  },
  app: {
    openSettings: () => ipcRenderer.send('app:openSettings'),
    onOpenSettings: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on('app:openSettings', handler)
      return () => ipcRenderer.removeListener('app:openSettings', handler)
    }
  },
  widgetWindows: {
    detach: (id, rect) => ipcRenderer.invoke('widgetWindows:detach', id, rect),
    attach: (id) => ipcRenderer.invoke('widgetWindows:attach', id),
    setOptions: (id, options) => ipcRenderer.invoke('widgetWindows:setOptions', id, options),
    open: (widget) => ipcRenderer.invoke('widgetWindows:open', widget),
    focus: (id) => ipcRenderer.invoke('widgetWindows:focus', id),
    close: (id) => ipcRenderer.invoke('widgetWindows:close', id),
    editBack: (id) => ipcRenderer.invoke('widgetWindows:editBack', id),
    finishEditBack: (id) => ipcRenderer.invoke('widgetWindows:finishEditBack', id),
    setAllVisible: (visible) => ipcRenderer.invoke('widgetWindows:setAllVisible', visible),
    setSizeLimits: (min, max) => ipcRenderer.send('widgetWindows:setSizeLimits', min, max)
  }
}

contextBridge.exposeInMainWorld('api', api)
