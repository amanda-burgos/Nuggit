import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { shell } from 'electron'
import type { MusicStatus, SavedPlaylist } from '../shared/types'
import { spotifyUri } from '../shared/music'
import { changeSettings } from './settings'
import { loadSettings } from './storage'

// SPEC 9.19: music by controlling the Spotify app on this Mac with AppleScript, during
// Focus (Paso 1) and at any time from the Música widget and its menu bar icon. No login
// and no Premium needed. The first time, macOS asks whether Nuggit may control Spotify.
// If Spotify isn't installed or open, things go on without music (the widgets say so
// kindly) — Nuggit never opens it on its own.

const IS_MAC = process.platform === 'darwin'
const APP_PATHS = ['/Applications/Spotify.app', join(homedir(), 'Applications/Spotify.app')]

class AccessError extends Error {}

// Long enough for the person to answer macOS's "may Nuggit control Spotify?" the first time.
const TIMEOUT_MS = 60_000
// Spotify takes a moment to change state after a command.
const SETTLE_MS = 400

function osa(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-e', script],
      { timeout: TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout.trim())
        if (/-1743|not allowed|no autorizado/i.test(stderr)) return reject(new AccessError(stderr))
        reject(new Error(stderr.trim() || err.message))
      }
    )
  })
}

const installed = (): boolean => IS_MAC && APP_PATHS.some((p) => existsSync(p))

// "is running" doesn't talk to Spotify, so it never opens it or asks for permission.
async function running(): Promise<boolean> {
  return (await osa('application "Spotify" is running').catch(() => 'false')) === 'true'
}

// Whether the music playing now was started by Nuggit: pausing the timer only pauses
// music Nuggit put on, never something the person was already listening to.
let ours = false

const NOTHING: MusicStatus = { app: 'closed', playing: false, track: null, artist: null }

// details: false only checks that Spotify is open (no permission needed, nothing asked).
export async function getMusicStatus(details = true): Promise<MusicStatus> {
  if (!installed()) return { ...NOTHING, app: 'not-installed' }
  if (!(await running())) return NOTHING
  if (!details) return { ...NOTHING, app: 'ready' }
  try {
    // Each piece on its own: an ad (or nothing loaded) lacks some of them.
    const out = await osa(`tell application "Spotify"
  set s to player state as string
  set v to ""
  set n to ""
  set a to ""
  set w to ""
  set p to ""
  set d to ""
  try
    set v to sound volume as string
  end try
  try
    set n to name of current track
  end try
  try
    set a to artist of current track
  end try
  try
    set w to artwork url of current track
  end try
  try
    set p to player position as string
  end try
  try
    set d to (duration of current track) as string
  end try
  return s & linefeed & v & linefeed & n & linefeed & a & linefeed & w & linefeed & p & linefeed & d
end tell`)
    const [state, volume, track, artist, artwork, position, duration] = out.split('\n')
    // Spanish macOS writes decimals with a comma ("12,5").
    const num = (text: string | undefined): number | null => {
      const n = Number((text ?? '').replace(',', '.'))
      return text && Number.isFinite(n) ? n : null
    }
    const ms = num(duration)
    return {
      app: 'ready',
      playing: state === 'playing',
      track: track || null,
      artist: artist || null,
      artwork:
        artwork && /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//.test(artwork)
          ? artwork
          : null,
      volume: num(volume),
      position: num(position),
      duration: ms === null ? null : ms / 1000
    }
  } catch (err) {
    if (err instanceof AccessError) return { ...NOTHING, app: 'denied' }
    console.warn('[music] status', err)
    return NOTHING
  }
}

// Only when Spotify is open: never launches it behind the person's back.
async function tell(command: string): Promise<MusicStatus> {
  if (installed() && (await running())) {
    try {
      await osa(`tell application "Spotify" to ${command}`)
      await new Promise((r) => setTimeout(r, SETTLE_MS))
    } catch (err) {
      if (err instanceof AccessError) return { ...NOTHING, app: 'denied' }
      console.warn('[music]', command, err)
    }
  }
  return getMusicStatus()
}

// From Nuggit's own ⏯ ⏭: music put on here is Nuggit's, so Focus pauses it in the break.
export async function playPause(): Promise<MusicStatus> {
  const status = await tell('playpause')
  ours = status.playing
  return status
}

export const previousTrack = (): Promise<MusicStatus> => tell('previous track')

export function setVolume(input: unknown): Promise<MusicStatus> {
  const volume =
    typeof input === 'number' && Number.isFinite(input)
      ? Math.round(Math.min(100, Math.max(0, input)))
      : null
  return volume === null ? getMusicStatus() : tell(`set sound volume to ${volume}`)
}

export async function nextTrack(): Promise<MusicStatus> {
  const status = await tell('next track')
  ours = status.playing
  return status
}

function playUri(uri: string): Promise<MusicStatus> {
  // The URI was checked (only letters and numbers after "spotify:kind:"), so it is safe here.
  return tell(`play track "${uri}"`)
}

// "▶ Probar" in Ajustes: the person asked for it, so it says why if it can't.
export async function playLink(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const uri = typeof input === 'string' ? spotifyUri(input) : null
  if (!uri) return { ok: false, error: 'Ese no parece un link de Spotify.' }
  if (!installed()) return { ok: false, error: 'Spotify no está instalado en esta Mac.' }
  if (!(await running())) return { ok: false, error: 'Abre Spotify primero y vuelve a probar.' }
  const status = await playUri(uri)
  if (status.app === 'denied') return { ok: false, error: DENIED }
  ours = status.playing
  return { ok: true }
}

export const DENIED =
  'macOS no deja que Nuggit controle Spotify. Actívalo en Ajustes del Sistema → Privacidad y seguridad → Automatización.'

export async function openSpotify(): Promise<void> {
  const app = APP_PATHS.find((p) => existsSync(p))
  if (app) await shell.openPath(app)
}

// --- What Focus does with the music (only when it's turned on in Ajustes) ---

async function musicOn(): Promise<boolean> {
  const { music } = await loadSettings()
  return music.enabled && Boolean(music.focusPlaylist)
}

export async function onFocusStart(): Promise<void> {
  const { music } = await loadSettings()
  if (!music.enabled || !music.focusPlaylist) return
  const status = await playUri(music.focusPlaylist)
  ours = status.app === 'ready'
}

export async function onBreakStart(): Promise<void> {
  if (!(await musicOn())) return
  const { music } = await loadSettings()
  if (music.onBreak === 'playlist' && music.breakPlaylist) {
    const status = await playUri(music.breakPlaylist)
    ours = status.app === 'ready'
  } else if (ours) {
    await tell('pause')
  }
}

// The round is over (or cancelled): the music stops.
export async function onFocusStop(): Promise<void> {
  if (!ours || !(await musicOn())) return
  await tell('pause')
  ours = false
}

// The timer was paused or resumed: the music follows, if it's Nuggit's.
export async function onFocusPause(paused: boolean): Promise<void> {
  if (!ours || !(await musicOn())) return
  await tell(paused ? 'pause' : 'play')
}

// --- Saved playlists (to choose from in the Música widget) ---

const MAX_PLAYLISTS = 20

// The name and picture of a playlist from Spotify's public oEmbed page: no login needed.
async function describe(uri: string): Promise<SavedPlaylist> {
  const [, kind, id] = uri.split(':')
  const page = `https://open.spotify.com/${kind}/${id}`
  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(page)}`,
      {
        signal: AbortSignal.timeout(8000)
      }
    )
    if (response.ok) {
      const data = (await response.json()) as { title?: unknown; thumbnail_url?: unknown }
      const name = typeof data.title === 'string' ? data.title.slice(0, 120) : ''
      const image = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined
      if (name) return { uri, name, ...(image ? { image } : {}) }
    }
  } catch (err) {
    console.warn('[music] no name for the playlist', err)
  }
  return { uri, name: kind === 'album' ? 'Álbum de Spotify' : 'Playlist de Spotify' }
}

export async function addPlaylist(link: unknown): Promise<{ ok: boolean; error?: string }> {
  const uri = typeof link === 'string' ? spotifyUri(link) : null
  if (!uri) return { ok: false, error: 'Ese no parece un link de Spotify.' }
  const { music } = await loadSettings()
  if (music.playlists.some((p) => p.uri === uri)) return { ok: true }
  if (music.playlists.length >= MAX_PLAYLISTS) {
    return { ok: false, error: `Caben ${MAX_PLAYLISTS} playlists. Quita alguna primero.` }
  }
  const playlist = await describe(uri)
  await changeSettings({ music: { playlists: [...music.playlists, playlist] } })
  return { ok: true }
}

export async function removePlaylist(uri: unknown): Promise<void> {
  const { music } = await loadSettings()
  await changeSettings({ music: { playlists: music.playlists.filter((p) => p.uri !== uri) } })
}

// Whether to show the music icon when the person hasn't chosen: only if Spotify is here.
export const spotifyInstalled = installed
