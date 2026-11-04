import { app, BrowserWindow, net, powerMonitor, shell } from 'electron'
import { isNewer, parseVersion, type UpdateInfo } from '../shared/updates'

// Fase 15: "nueva versión disponible". When Nuggit opens (and every few hours) it asks
// GitHub for the latest Release. If it is newer than this app, the main window shows a
// notice with "Descargar" (opens the Release page) and "Ahora no". No internet, no
// Release yet, or any error: nothing happens.
// While developing, NUGGIT_UPDATE_REPO=owner/name tries it against another repo's Releases.
const DEV_REPO = !app.isPackaged ? process.env.NUGGIT_UPDATE_REPO : undefined
const REPO = DEV_REPO && /^[\w.-]+\/[\w.-]+$/.test(DEV_REPO) ? DEV_REPO : 'amanda-burgos/Nuggit'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases/`
const FIRST_CHECK_MS = 5_000
const EVERY_MS = 4 * 60 * 60 * 1000 // every 4 hours
const TIMEOUT_MS = 10_000

let available: UpdateInfo | null = null
let dismissed: string | null = null // "Ahora no" for this version, until Nuggit restarts
let checking = false

async function check(): Promise<void> {
  if (checking || !net.isOnline()) return
  checking = true
  try {
    const response = await net.fetch(API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Nuggit' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) return // 404 = no Release published yet
    const release = (await response.json()) as Record<string, unknown>
    const tag = typeof release.tag_name === 'string' ? release.tag_name : ''
    const page = typeof release.html_url === 'string' ? release.html_url : ''
    const version = parseVersion(tag)?.join('.')
    if (!version || !page.startsWith(RELEASES_PAGE)) return
    if (!isNewer(version, app.getVersion())) return
    if (available?.version === version) return
    available = { version, url: page }
    if (dismissed !== version) broadcast()
  } catch {
    // Offline, GitHub slow or down: try again at the next check.
  } finally {
    checking = false
  }
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows())
    win.webContents.send('updates:available', available)
}

// What the main window shows when it opens (null = nothing to show).
export function pendingUpdate(): UpdateInfo | null {
  return available && dismissed !== available.version ? available : null
}

export function dismissUpdate(): void {
  if (available) dismissed = available.version
}

export async function openUpdatePage(): Promise<void> {
  if (available?.url.startsWith(RELEASES_PAGE)) await shell.openExternal(available.url)
}

export function initUpdates(): void {
  setTimeout(() => void check(), FIRST_CHECK_MS)
  setInterval(() => void check(), EVERY_MS)
  // After the Mac sleeps the timer may be late, and the network comes back a bit later.
  powerMonitor.on('resume', () => setTimeout(() => void check(), 30_000))
}
