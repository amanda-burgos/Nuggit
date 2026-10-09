import { contextBridge } from 'electron'

// Safe API exposed to the renderer. Disk and AI access will be added here
// (via IPC to the main process) in later phases.
const api = {}

contextBridge.exposeInMainWorld('api', api)
