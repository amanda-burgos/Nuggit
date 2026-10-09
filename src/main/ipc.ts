import { ipcMain } from 'electron'
import { loadDesktop, loadSettings, saveDesktop, updateSettings } from './storage'

export function registerIpc(): void {
  ipcMain.handle('desktop:load', () => loadDesktop())
  ipcMain.handle('desktop:save', (_event, state: unknown) => saveDesktop(state))
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:update', (_event, patch: unknown) => updateSettings(patch))
}
