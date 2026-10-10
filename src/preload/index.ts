import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { NuggitApi, SavedDesktop } from '../shared/types'

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
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch)
  },
  widgetWindows: {
    detach: (id, rect) => ipcRenderer.invoke('widgetWindows:detach', id, rect),
    attach: (id) => ipcRenderer.invoke('widgetWindows:attach', id),
    setAlwaysOnTop: (id, on) => ipcRenderer.invoke('widgetWindows:setAlwaysOnTop', id, on),
    setAllVisible: (visible) => ipcRenderer.invoke('widgetWindows:setAllVisible', visible),
    setSizeLimits: (min, max) => ipcRenderer.send('widgetWindows:setSizeLimits', min, max)
  }
}

contextBridge.exposeInMainWorld('api', api)
