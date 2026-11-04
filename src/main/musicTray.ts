import { nativeImage, Tray } from 'electron'
import type { PickupTrayMode } from '../shared/types'
import { createTrayPopover, type TrayPopover } from './trayPopover'
import { onLangChange, t } from '../shared/i18n'

// SPEC 9.19, "Música sin Focus": its own menu bar icon opens a small floating player with
// the same controls as the Música widget. It can also live inside Nuggit's menu, or hide.

let tray: Tray | null = null
let popover: TrayPopover | null = null
let mode: PickupTrayMode = 'off'
const listeners = new Set<(mode: PickupTrayMode) => void>()

// A musical note, drawn in code as a template image so macOS paints it right in light
// and dark menu bars (like the quick pickup's icon).
let icon: Electron.NativeImage | null = null
function noteIcon(): Electron.NativeImage {
  if (icon) return icon
  const scale = 2
  const px = 18 * scale
  const inShape = (x: number, y: number): boolean => {
    // Tilted oval head, bottom left.
    const hx = x - 12
    const hy = y - 27
    const rx = hx * Math.cos(0.45) + hy * Math.sin(0.45)
    const ry = -hx * Math.sin(0.45) + hy * Math.cos(0.45)
    if ((rx / 6) ** 2 + (ry / 4.4) ** 2 <= 1) return true
    // Stem, on the head's right side.
    if (x >= 15.5 && x <= 18 && y >= 6 && y <= 27) return true
    // Flag, curving down to the right.
    const fy = 6 + (x - 18) * 0.55
    return x >= 18 && x <= 27 && y >= fy && y <= fy + 4.5 + (x - 18) * 0.25
  }
  const bitmap = Buffer.alloc(px * px * 4)
  const samples = 4
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (inShape(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)) hits++
        }
      }
      bitmap[(y * px + x) * 4 + 3] = Math.round((255 * hits) / (samples * samples))
    }
  }
  icon = nativeImage.createFromBitmap(bitmap, { width: px, height: px, scaleFactor: scale })
  icon.setTemplateImage(true)
  return icon
}

export function showMusicPlayer(): void {
  popover?.show(tray?.getBounds())
}

function toggle(): void {
  popover?.toggle(tray?.getBounds())
}

export function getMusicTrayMode(): PickupTrayMode {
  return mode
}

export function onMusicTrayModeChange(listener: (mode: PickupTrayMode) => void): void {
  listeners.add(listener)
}

export function setMusicTrayMode(next: PickupTrayMode): void {
  if (next === 'icon' && !tray) {
    tray = new Tray(noteIcon())
    tray.setToolTip(t('Música', 'Music'))
    tray.on('click', toggle)
    tray.on('right-click', toggle)
  } else if (next !== 'icon' && tray) {
    tray.destroy()
    tray = null
  }
  if (next === mode) return
  mode = next
  listeners.forEach((listener) => listener(next))
}

export function initMusicTray(initial: PickupTrayMode): void {
  popover = createTrayPopover({
    size: { width: 320, height: 380 },
    view: 'music',
    title: () => t('Música', 'Music')
  })
  setMusicTrayMode(initial)
  onLangChange(() => tray?.setToolTip(t('Música', 'Music')))
}
