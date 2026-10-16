import { BrowserWindow, screen, type Rectangle } from 'electron'
import { createAppWindow } from './appWindow'

// A small floating window that opens under a menu bar icon (Dip's mini chat, the quick
// pickup). It opens over any app, even in full screen, and hides when you click outside.

export interface TrayPopover {
  // anchor: the menu bar icon's bounds; without it, it opens at the top center of the screen.
  show(anchor?: Rectangle): void
  hide(): void
  toggle(anchor?: Rectangle): void
}

export function createTrayPopover(options: {
  size: { width: number; height: number }
  view: string // what the renderer shows (?view=...)
  title: string
}): TrayPopover {
  const { size } = options
  let popover: BrowserWindow | null = null

  const create = (): BrowserWindow => {
    const win = createAppWindow(
      {
        ...size,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        // A non-activating panel: it opens over any app (even full screen) without bringing
        // Nuggit's other windows to the front.
        type: 'panel',
        title: options.title
      },
      { view: options.view }
    )
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.on('blur', () => win.hide())
    win.on('closed', () => {
      if (popover === win) popover = null
    })
    return win
  }

  // Under the menu bar icon, or at the top center of the screen with the mouse.
  const place = (win: BrowserWindow, anchor?: Rectangle): void => {
    const hasAnchor = Boolean(anchor && anchor.width)
    const point = hasAnchor ? { x: anchor!.x, y: anchor!.y } : screen.getCursorScreenPoint()
    const { workArea } = screen.getDisplayNearestPoint(point)
    const x = hasAnchor
      ? anchor!.x + anchor!.width / 2 - size.width / 2
      : workArea.x + workArea.width / 2 - size.width / 2
    win.setPosition(
      Math.round(
        Math.min(Math.max(x, workArea.x + 8), workArea.x + workArea.width - size.width - 8)
      ),
      Math.round(workArea.y + 6)
    )
  }

  const show = (anchor?: Rectangle): void => {
    if (!popover) popover = create()
    const win = popover
    place(win, anchor)
    const reveal = (): void => {
      win.show()
      win.focus()
    }
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', reveal)
    else reveal()
  }

  const hide = (): void => popover?.hide()

  // Load it ahead of time so it opens instantly the first time.
  popover = create()

  return {
    show,
    hide,
    toggle: (anchor) => (popover?.isVisible() ? hide() : show(anchor))
  }
}
