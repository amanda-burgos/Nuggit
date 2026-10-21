import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { shell } from 'electron'
import type { MusicStatus } from '../shared/types'
import { spotifyUri } from '../shared/music'
import { loadSettings } from './storage'

// SPEC 9.19, Paso 1: music while Focus runs, by controlling the Spotify app on this Mac
// with AppleScript. No login and no Premium needed. The first time, macOS asks whether
// Nuggit may control Spotify. If Spotify isn't installed or open, Focus goes on without
// music (the widget says so kindly) — Nuggit never opens it on its own.

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
    const out = await osa(`tell application "Spotify"
  set s to player state as string
  try
    return s & linefeed & (name of current track) & linefeed & (artist of current track)
  on error
    return s
  end try
end tell`)
    const [state, track, artist] = out.split('\n')
    return {
      app: 'ready',
      playing: state === 'playing',
      track: track || null,
      artist: artist || null
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
