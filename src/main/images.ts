import { app, BrowserWindow, dialog, net, protocol, type WebContents } from 'electron'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { extname, join } from 'path'
import { pathToFileURL } from 'url'
import { getDesktop } from './desktop'
import { IMAGE_NAME, loadSettings } from './storage'
import { t } from '../shared/i18n'

// Fase 9: pictures chosen by the person (backgrounds, the image widget, SPEC 9.17). Each
// one is COPIED into Nuggit's data folder with a generated name, so moving or deleting the
// original doesn't break anything. The pages show them through nuggit-img://, which only
// serves files from that folder.

const SCHEME = 'nuggit-img'
const MAX_BYTES = 30 * 1024 * 1024
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'heic', 'heif']

const imagesDir = (): string => join(app.getPath('userData'), 'images')

// Must run before the app is ready.
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

export function serveImages(): void {
  protocol.handle(SCHEME, (request) => {
    // nuggit-img://image/<name>
    const name = decodeURIComponent(new URL(request.url).pathname.slice(1))
    if (!IMAGE_NAME.test(name)) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(join(imagesDir(), name)).toString())
  })
}

// Photos from an iPhone (HEIC) are turned into JPEG: Chromium can't show HEIC.
function toJpeg(from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile(
      '/usr/bin/sips',
      ['-s', 'format', 'jpeg', from, '--out', to],
      { timeout: 30_000 },
      (err) => (err ? reject(err) : resolve())
    )
  )
}

async function copyIn(file: string): Promise<string | null> {
  const stat = await fs.stat(file).catch(() => null)
  if (!stat?.isFile() || stat.size > MAX_BYTES) return null
  const ext = extname(file).slice(1).toLowerCase()
  if (!EXTENSIONS.includes(ext)) return null
  await fs.mkdir(imagesDir(), { recursive: true })
  const heic = ext === 'heic' || ext === 'heif'
  const name = `${randomUUID()}.${heic ? 'jpg' : ext}`
  const target = join(imagesDir(), name)
  if (heic && process.platform === 'darwin') await toJpeg(file, target)
  else if (heic) return null
  else await fs.copyFile(file, target)
  return name
}

// Lets the person choose pictures; returns the names of the copies.
export async function pickImages(sender: WebContents, multiple: unknown): Promise<string[]> {
  const win = BrowserWindow.fromWebContents(sender)
  const options: Electron.OpenDialogOptions = {
    title: t('Elegir imagen', 'Choose an image'),
    properties: multiple === true ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: t('Imágenes', 'Images'), extensions: EXTENSIONS }]
  }
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (canceled) return []
  const names: string[] = []
  for (const file of filePaths.slice(0, 50)) {
    try {
      const name = await copyIn(file)
      if (name) names.push(name)
    } catch (err) {
      console.error('[images] could not copy', err)
    }
  }
  return names
}

// At start-up: copies left over (a removed image widget, say) are deleted. Runs after the
// desktop and settings are loaded, so everything in use is known.
export async function cleanUpImages(): Promise<void> {
  const files = await fs.readdir(imagesDir()).catch(() => [] as string[])
  if (files.length) await forgetImages(files)
}

// Deletes copies nothing uses anymore (a background, a widget's background, an image widget).
export async function forgetImages(input: unknown): Promise<void> {
  if (!Array.isArray(input)) return
  const inUse = JSON.stringify([getDesktop(), (await loadSettings()).appearance])
  for (const name of input) {
    if (typeof name !== 'string' || !IMAGE_NAME.test(name) || inUse.includes(name)) continue
    await fs.rm(join(imagesDir(), name), { force: true })
  }
}
