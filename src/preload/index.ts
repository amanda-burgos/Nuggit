import { contextBridge, ipcRenderer } from 'electron'
import type { NuggitApi } from '../shared/types'

// Safe API exposed to the renderer. All disk access goes through the main process.
const api: NuggitApi = {
  desktop: {
    load: () => ipcRenderer.invoke('desktop:load'),
    save: (state) => ipcRenderer.invoke('desktop:save', state)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch)
  }
}

contextBridge.exposeInMainWorld('api', api)
