import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import type { StatusIndicator, Task } from '../shared/types'
import { getTasks, onTasksChange, updateTask } from './tasks'

// While something is "En curso", Nuggit shows a small indicator in the macOS menu bar, so
// you always know you're on something. What it shows is a setting: a lavender dot, the dot
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

function nextStep(task: Task, tasks: Task[]): Task | undefined {
  return tasks
    .filter((t) => t.parentId === task.id && t.status !== 'done')
    .sort((a, b) => a.order - b.order)[0]
}

function buildMenu(doing: Task[], tasks: Task[]): Menu {
  const items: MenuItemConstructorOptions[] = []
  for (const task of doing) {
    const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : undefined
    const steps = tasks.filter((t) => t.parentId === task.id)
    const step = nextStep(task, tasks)
    items.push({ label: `▶ ${shorten(task.title, 48)}`, enabled: false })
    if (parent) items.push({ label: `De: ${shorten(parent.title, 44)}`, enabled: false })
    if (step) {
      // The current small step comes first: one click marks it done and the menu moves on.
      const number = steps.filter((t) => t.status === 'done').length + 1
      items.push(
        { label: `Paso ${number} de ${steps.length}`, enabled: false },
        {
          label: `✅ Listo: ${shorten(step.title, 40)}`,
          click: () => updateTask(step.id, { status: 'done' })
        },
        {
          label: 'Terminar toda la tarea',
          click: () => updateTask(task.id, { status: 'done' })
        }
      )
    } else {
      items.push({
        label: '✅ Marcar tarea como hecha',
        click: () => updateTask(task.id, { status: 'done' })
      })
    }
    items.push(
      { label: '⏸ Pausar', click: () => updateTask(task.id, { status: 'todo' }) },
      { type: 'separator' }
    )
  }
  items.push(
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

function render(tasks: Task[]): void {
  const doing = tasks.filter((t) => t.status === 'doing')
  if (doing.length === 0 || mode === 'off') {
    tray?.destroy()
    tray = null
    return
  }

  const showDot = mode !== 'title'
  if (!tray) tray = new Tray(showDot ? dotIcon() : nativeImage.createEmpty())
  else tray.setImage(showDot ? dotIcon() : nativeImage.createEmpty())

  const name = shorten(doing[0].title)
  const extra = doing.length > 1 ? ` +${doing.length - 1}` : ''
  if (mode === 'dot') tray.setTitle('')
  else if (mode === 'dot-title') tray.setTitle(`${name}${extra}`)
  else tray.setTitle(`▶ ${name}${extra}`)

  tray.setToolTip(`En curso: ${name}${extra}`)
  tray.setContextMenu(buildMenu(doing, tasks))
}

export function setStatusIndicator(next: StatusIndicator): void {
  if (next === mode) return
  mode = next
  render(getTasks())
}

export function initStatusTray(options: {
  mode: StatusIndicator
  openApp(): void
  chooseMode(mode: StatusIndicator): void
}): void {
  mode = options.mode
  openApp = options.openApp
  chooseMode = options.chooseMode
  render(getTasks())
  onTasksChange(render)
}
