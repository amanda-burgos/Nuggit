import { BrowserWindow, Menu, shell, type WebContents } from 'electron'

// SPEC 9.10, basic voice. Talking to Dip uses the Mac's own dictation: Nuggit only starts
// it in the text field that has the cursor, and macOS turns speech into text (nothing is
// recorded or sent anywhere by Nuggit). Dip's spoken answers happen in the interface.

// The system settings page where Dictation is turned on (macOS 13+).
const DICTATION_SETTINGS = 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'

export function dictate(from: WebContents): void {
  if (process.platform !== 'darwin') return
  const win = BrowserWindow.fromWebContents(from)
  if (win && !win.isFocused()) win.focus()
  // The same as Edit → Start Dictation. If Dictation is off, macOS offers to turn it on.
  Menu.sendActionToFirstResponder('startDictation:')
}

export async function openDictationSettings(): Promise<void> {
  if (process.platform === 'darwin') await shell.openExternal(DICTATION_SETTINGS)
}
