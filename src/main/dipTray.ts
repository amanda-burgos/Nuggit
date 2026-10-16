import { app, globalShortcut, nativeImage, Tray } from 'electron'
import type { DipShortcut, Settings } from '../shared/types'
import { createTrayPopover, type TrayPopover } from './trayPopover'
import dipTemplate from '../../resources/icons/dipTemplate.png?asset'

// SPEC 9.15: Dip's own menu bar icon (apart from Nuggit's, 9.11). Clicking it opens a small
// floating window under the icon with a mini chat, the same conversation as the Dip tab.
// It closes on a click outside, with its X or with Esc. An optional global shortcut opens it
// from any app.

let tray: Tray | null = null
let popover: TrayPopover | null = null
let shortcut: DipShortcut = ''
let shortcutOk = true

// A one-colour template image (with an @2x file next to it for Retina): macOS paints it
// right in light and dark menu bars.
let icon: Electron.NativeImage | null = null
function dipIcon(): Electron.NativeImage {
  if (icon) return icon
  icon = nativeImage.createFromPath(dipTemplate)
  icon.setTemplateImage(true)
  return icon
}

function togglePopover(): void {
  popover?.toggle(tray?.getBounds())
}

function setTrayVisible(visible: boolean): void {
  if (visible && !tray) {
    tray = new Tray(dipIcon())
    tray.setToolTip('Dip')
    tray.on('click', togglePopover)
    tray.on('right-click', togglePopover)
  } else if (!visible && tray) {
    tray.destroy()
    tray = null
  }
}

function setShortcut(next: DipShortcut): void {
  if (next === shortcut) return
  if (shortcut) globalShortcut.unregister(shortcut)
  shortcut = next
  shortcutOk = next ? globalShortcut.register(next, togglePopover) : true
  if (!shortcutOk) console.warn(`[dip-tray] the shortcut ${next} is taken by another app`)
}

export function setDipTrayOptions(options: Settings['dipTray']): void {
  setTrayVisible(options.visible)
  setShortcut(options.shortcut)
}

export function dipShortcutWorks(): boolean {
  return shortcutOk
}

export function initDipTray(options: Settings['dipTray']): void {
  popover = createTrayPopover({ size: { width: 360, height: 500 }, view: 'popover', title: 'Dip' })
  setDipTrayOptions(options)
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
