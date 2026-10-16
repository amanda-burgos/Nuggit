import { nativeImage, Tray } from 'electron'
import type { PickupTrayMode } from '../shared/types'
import { createTrayPopover, type TrayPopover } from './trayPopover'

// SPEC 9.16: the quick pickup. Its own menu bar icon opens a small window with a search box
// and every widget: open ones (bring to front, close, "Pin on top") and ones to add, which
// appear detached on the desktop right away. It can also live inside Nuggit's menu (9.11).

let tray: Tray | null = null
let popover: TrayPopover | null = null
let mode: PickupTrayMode = 'icon'
const listeners = new Set<(mode: PickupTrayMode) => void>()

// Four rounded squares (a little widget grid), drawn in code as a template image so macOS
// paints it right in light and dark menu bars.
let icon: Electron.NativeImage | null = null
function pickupIcon(): Electron.NativeImage {
  if (icon) return icon
  const scale = 2
  const px = 18 * scale
  const squares = [
    [5, 5],
    [19, 5],
    [5, 19],
    [19, 19]
  ] // top-left corners, 12px squares
  const inShape = (x: number, y: number): boolean =>
    squares.some(([sx, sy]) => {
      // Rounded square: distance to the inner 6x6 box at most 3.
      const dx = Math.max(sx + 3 - x, 0, x - (sx + 9))
      const dy = Math.max(sy + 3 - y, 0, y - (sy + 9))
      return Math.hypot(dx, dy) <= 3
    })
  const bitmap = Buffer.alloc(px * px * 4)
  const samples = 4 // per axis, for smooth edges
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (inShape(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)) hits++
        }
      }
      // Black with coverage as alpha (BGRA, premultiplied: black stays 0).
      bitmap[(y * px + x) * 4 + 3] = Math.round((255 * hits) / (samples * samples))
    }
  }
  icon = nativeImage.createFromBitmap(bitmap, { width: px, height: px, scaleFactor: scale })
  icon.setTemplateImage(true)
  return icon
}

// Opens the quick pickup under its icon, or at the top center of the screen.
export function showPickup(): void {
  popover?.show(tray?.getBounds())
}

function toggle(): void {
  popover?.toggle(tray?.getBounds())
}

export function getPickupMode(): PickupTrayMode {
  return mode
}

export function onPickupModeChange(listener: (mode: PickupTrayMode) => void): void {
  listeners.add(listener)
}

export function setPickupMode(next: PickupTrayMode): void {
  if (next === 'icon' && !tray) {
    tray = new Tray(pickupIcon())
    tray.setToolTip('Widgets')
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

export function initPickupTray(initial: PickupTrayMode): void {
  popover = createTrayPopover({
    size: { width: 340, height: 460 },
    view: 'pickup',
    title: 'Widgets'
  })
  setPickupMode(initial)
}
