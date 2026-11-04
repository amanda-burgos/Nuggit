import { t } from './i18n'

// Keyboard shortcuts shown the way each system writes them: ⌘ ⌥ ⇧ ⌃ on a Mac,
// "Ctrl", "Alt", "Shift" joined with "+" on Windows and Linux ("Ctrl+1").

export type Platform = 'mac' | 'windows' | 'linux'

// Main process: process.platform. Windows (renderer, no Node there): navigator.
function detect(): Platform {
  const proc = (globalThis as { process?: { platform?: string } }).process
  const name =
    proc?.platform ??
    (typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '')
  if (/^darwin$|mac/i.test(name)) return 'mac'
  if (/^win32$|win/i.test(name)) return 'windows'
  return 'linux'
}

export const PLATFORM: Platform = detect()
export const IS_MAC = PLATFORM === 'mac'

const MAC_SYMBOLS: Record<string, string> = {
  commandorcontrol: '⌘',
  cmdorctrl: '⌘',
  mod: '⌘',
  command: '⌘',
  cmd: '⌘',
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧'
}

const PC_NAMES: Record<string, string> = {
  commandorcontrol: 'Ctrl',
  cmdorctrl: 'Ctrl',
  mod: 'Ctrl',
  command: 'Win',
  cmd: 'Win',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift'
}

const keyName = (key: string): string => {
  const lower = key.toLowerCase()
  if (lower === 'space') return t('Espacio', 'Space')
  if (lower === 'enter' || lower === 'return') return 'Enter'
  if (lower === 'escape' || lower === 'esc') return 'Esc'
  return key.length === 1 ? key.toUpperCase() : key
}

// An Electron accelerator ("CommandOrControl+Shift+Space", "Mod+1") as this system shows it:
// Mac "⌘ ⇧ Espacio" / "⌘1", Windows and Linux "Ctrl+Shift+Space" / "Ctrl+1".
export function formatShortcut(accelerator: string, platform: Platform = PLATFORM): string {
  const parts = accelerator.split('+').filter(Boolean)
  const key = parts.pop() ?? ''
  if (platform === 'mac') {
    const mods = parts.map((p) => MAC_SYMBOLS[p.toLowerCase()] ?? p)
    const name = keyName(key)
    // "⌘1", "⌘N", "⌘," together; with a word ("Espacio") everything spaced out.
    return name.length === 1 ? `${mods.join('')}${name}` : [...mods, name].join(' ')
  }
  return [...parts.map((p) => PC_NAMES[p.toLowerCase()] ?? p), keyName(key)].join('+')
}

// The same thing said per system: bySystem(mac, windows, linux = windows).
export const bySystem = <T>(mac: T, windows: T, linux: T = windows, platform = PLATFORM): T =>
  platform === 'mac' ? mac : platform === 'windows' ? windows : linux

// Where Nuggit's icons live: the Mac's menu bar (up top), or the system tray on Windows
// (bottom right, next to the clock) and Linux.
export const trayName = (): string =>
  bySystem(t('barra de menú', 'menu bar'), t('bandeja del sistema', 'system tray'))
export const TrayName = (): string =>
  bySystem(t('Barra de menú', 'Menu bar'), t('Bandeja del sistema', 'System tray'))
export const trayPlace = (): string =>
  bySystem(
    t('arriba, en la barra de menú', 'up top, in the menu bar'),
    t(
      'abajo a la derecha, en la bandeja del sistema junto al reloj',
      'at the bottom right, in the system tray next to the clock'
    ),
    t('en la bandeja del sistema', 'in the system tray')
  )

// Help texts (config/help*.json) write shortcuts with markers: "{mod}3" → "⌘3" / "Ctrl+3",
// "{shift}Enter" → "⇧ Enter" / "Shift+Enter", "{alt}" → "⌥ " / "Alt+",
// "{dictate}" → the system's dictation keys, and text that changes per system as
// "{mac:la barra de menú|win:la bandeja del sistema}" (linux: like win unless "|linux:…").
export function withKeys(text: string, platform: Platform = PLATFORM): string {
  const mac = platform === 'mac'
  return text
    .replace(
      /\{mac:([^|}]*)\|win:([^|}]*)(?:\|linux:([^}]*))?\}/g,
      (_all, onMac: string, onWin: string, onLinux?: string) =>
        bySystem(onMac, onWin, onLinux ?? onWin, platform)
    )
    .replace(/\{mod\}/g, mac ? '⌘' : 'Ctrl+')
    .replace(/\{shift\}/g, mac ? '⇧ ' : 'Shift+')
    .replace(/\{alt\}/g, mac ? '⌥ ' : 'Alt+')
    .replace(/\{dictate\}/g, mac ? 'Fn Fn (🌐)' : platform === 'windows' ? 'Win+H' : '')
}
