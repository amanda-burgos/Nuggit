import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import type { StatusIndicator, Task } from '../shared/types'
import { pickNextActions, toISODate, type NextAction } from '../shared/nextAction'
import { getNextActionState, onNextActionChange, skipAction, startAction } from './nextAction'
import { getPickupMode, onPickupModeChange, showPickup } from './pickupTray'
import { getMusicTrayMode, onMusicTrayModeChange, showMusicPlayer } from './musicTray'
import { completeTask, getTasks, onTasksChange, setStatuses, updateTask } from './tasks'

// While something is "En curso", Nuggit shows a small indicator in the macOS menu bar, so
// you always know you're on something (the same task and step as the Next Action widget). What it shows is a setting: a lavender dot, the dot
// plus the task name, just the name, or nothing. Clicking it opens a short menu.
// It disappears as soon as nothing is in progress.
let tray: Tray | null = null
let mode: StatusIndicator = 'dot'
let openApp: () => void = () => undefined
let chooseMode: (mode: StatusIndicator) => void = () => undefined

const MAX_TITLE = 28

const MODE_LABELS: Record<StatusIndicator, string> = {
  dot: 'Solo el puntito',
  'dot-title': 'Puntito y nombre de la tarea',
  title: 'Solo el nombre de la tarea',
  off: 'Nada (ocultar)'
}

function shorten(text: string, max = MAX_TITLE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// A filled lavender circle drawn in code (no image file needed), crisp on Retina.
let dot: Electron.NativeImage | null = null
function dotIcon(): Electron.NativeImage {
  if (dot) return dot
  const size = 18 // points
  const scale = 2
  const px = size * scale
  const radius = 4.5 * scale
  const center = px / 2
  const bitmap = Buffer.alloc(px * px * 4)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center)
      const alpha = Math.max(0, Math.min(1, radius - distance + 0.5)) // soft edge
      const i = (y * px + x) * 4
      // BGRA, premultiplied: lavender #8b72dd
      bitmap[i] = Math.round(0xdd * alpha)
      bitmap[i + 1] = Math.round(0x72 * alpha)
      bitmap[i + 2] = Math.round(0x8b * alpha)
      bitmap[i + 3] = Math.round(255 * alpha)
    }
  }
  dot = nativeImage.createFromBitmap(bitmap, { width: px, height: px, scaleFactor: scale })
  return dot
}

function buildMenu(top: NextAction, others: Task[]): Menu {
  const { task, root } = top
  const items: MenuItemConstructorOptions[] = [
    { label: `${top.started ? '▶' : 'Ahora:'} ${shorten(root.title, 48)}`, enabled: false }
  ]
  if (task !== root) {
    const minutes = task.estimateMin ? ` (${task.estimateMin} min)` : ''
    items.push({
      label: `Paso ${top.stepNumber} de ${top.stepCount}: ${shorten(task.title, 40)}${minutes}`,
      enabled: false
    })
  }
  if (top.nextStep) {
    items.push({ label: `Siguiente paso: ${shorten(top.nextStep.title, 40)}`, enabled: false })
  }
  items.push({ type: 'separator' })
  if (!top.started) items.push({ label: '▶ Empezar', click: () => startAction(task.id) })
  // Done with this step: the menu (and the Next Action widget) move on to the next one.
  items.push({ label: '✅ Marcar como hecha', click: () => completeTask(task.id) })
  if (task !== root) {
    items.push({
      label: 'Terminar toda la tarea',
      click: () => updateTask(root.id, { status: 'done' })
    })
  }
  items.push({ label: '⏭ Saltar', click: () => skipAction(task.id) })
  if (top.started) {
    items.push({
      label: '⏸ Pausar',
      click: () =>
        setStatuses(
          [root, task]
            .filter((t) => t.status === 'doing')
            .map((t) => ({ id: t.id, status: 'todo' }))
        )
    })
  }
  if (others.length) {
    items.push({ type: 'separator' })
    for (const t of others)
      items.push({ label: `También en curso: ${shorten(t.title, 36)}`, enabled: false })
  }
  items.push(
    { type: 'separator' },
    // The quick pickup can live here instead of having its own icon (SPEC 9.16).
    ...(getPickupMode() === 'menu'
      ? [{ label: '🧩 Widgets…', click: () => showPickup() } as MenuItemConstructorOptions]
      : []),
    // The music player can live here too (SPEC 9.19).
    ...(getMusicTrayMode() === 'menu'
      ? [{ label: '🎵 Música…', click: () => showMusicPlayer() } as MenuItemConstructorOptions]
      : []),
    {
      label: 'Mostrar en la barra',
      submenu: (Object.keys(MODE_LABELS) as StatusIndicator[]).map((m) => ({
        label: MODE_LABELS[m],
        type: 'radio',
        checked: m === mode,
        click: () => chooseMode(m)
      }))
    },
    { label: 'Abrir Nuggit', click: () => openApp() }
  )
  return Menu.buildFromTemplate(items)
}

// SPEC 9.11: while something is "En curso", the menu bar shows what the Next Action widget
// shows: the same task and the same next step.
function render(): void {
  const tasks = getTasks()
  const inProgress = tasks.some((t) => t.status === 'doing')
  const top = pickNextActions(tasks, getNextActionState(), toISODate(new Date()), 1)[0]
  if (!inProgress || !top || mode === 'off') {
    tray?.destroy()
    tray = null
    return
  }

  const showDot = mode !== 'title'
  if (!tray) tray = new Tray(showDot ? dotIcon() : nativeImage.createEmpty())
  else tray.setImage(showDot ? dotIcon() : nativeImage.createEmpty())

  // Other big tasks also "En curso".
  const others = tasks.filter((t) => !t.parentId && t.status === 'doing' && t.id !== top.root.id)
  const name = shorten(top.task.title)
  const extra = others.length ? ` +${others.length}` : ''
  if (mode === 'dot') tray.setTitle('')
  else if (mode === 'dot-title') tray.setTitle(`${name}${extra}`)
  else tray.setTitle(`${top.started ? '▶ ' : ''}${name}${extra}`)

  tray.setToolTip(`${top.started ? 'En curso' : 'Ahora'}: ${name}${extra}`)
  tray.setContextMenu(buildMenu(top, others))
}

export function setStatusIndicator(next: StatusIndicator): void {
  if (next === mode) return
  mode = next
  render()
}

export function initStatusTray(options: {
  mode: StatusIndicator
  openApp(): void
  chooseMode(mode: StatusIndicator): void
}): void {
  mode = options.mode
  openApp = options.openApp
  chooseMode = options.chooseMode
  render()
  onTasksChange(render)
  onNextActionChange(render)
  onPickupModeChange(render)
  onMusicTrayModeChange(render)
}
