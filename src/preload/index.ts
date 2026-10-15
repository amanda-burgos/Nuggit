import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AIStatus,
  DipChatState,
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
    setProvider: (provider) => ipcRenderer.invoke('ai:setProvider', provider),
    test: () => ipcRenderer.invoke('ai:test'),
    status: () => ipcRenderer.invoke('ai:status'),
    onStatusChange: (listener) => {
      const handler = (_event: IpcRendererEvent, status: AIStatus): void => listener(status)
      ipcRenderer.on('ai:status', handler)
      return () => ipcRenderer.removeListener('ai:status', handler)
    },
    chat: (messages) => ipcRenderer.invoke('ai:chat', messages),
    tenderQuestions: (task) => ipcRenderer.invoke('ai:tenderQuestions', task),
    proposeTenders: (request) => ipcRenderer.invoke('ai:proposeTenders', request),
    proposePersonality: (messages) => ipcRenderer.invoke('ai:proposePersonality', messages)
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
    setAllVisible: (visible) => ipcRenderer.invoke('widgetWindows:setAllVisible', visible),
    setSizeLimits: (min, max) => ipcRenderer.send('widgetWindows:setSizeLimits', min, max)
  }
}

contextBridge.exposeInMainWorld('api', api)
