import { useCallback, useEffect, useRef, useState } from 'react'
import type { MusicStatus, SavedPlaylist } from '../../../../shared/types'
import { useSettings } from '../../store/useSettings'
import type { WidgetProps } from '../types'
import './music.css'
import { t } from '../../../../shared/i18n'

// The music widget has no options yet.
export type MusicConfig = Record<string, never>

const POLL_MS = 2000
const VOLUME_DELAY_MS = 200
const log = (err: unknown): void => console.error('[music]', err)

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// What Spotify is doing, checked every couple of seconds while the player is on screen.
// Between checks the song's time moves on by itself.
function useMusicStatus(): {
  status: MusicStatus | null
  at: number // when it was checked
  setStatus(status: MusicStatus): void
  refresh(): void
} {
  const [current, setCurrent] = useState<{ status: MusicStatus; at: number } | null>(null)
  const setStatus = useCallback((status: MusicStatus) => setCurrent({ status, at: Date.now() }), [])

  const refresh = useCallback(() => {
    if (document.visibilityState === 'hidden') return
    window.api.music.status().then(setStatus).catch(log)
  }, [setStatus])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refresh])

  return { status: current?.status ?? null, at: current?.at ?? 0, setStatus, refresh }
}

// SPEC 9.19, "Música sin Focus": the Spotify app on this Mac, from a widget (board,
// detached, pinned), the Música tab or the menu bar mini player. Cover, song, ⏮ ⏯ ⏭,
// volume, and the saved playlists to choose from.
export function MusicWidget({ size }: WidgetProps<MusicConfig>): React.JSX.Element {
  const { status, at, setStatus, refresh } = useMusicStatus()
  const { settings } = useSettings()
  const [choosing, setChoosing] = useState(false)
  const [volume, setVolume] = useState<number | null>(null)
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // The song's time ticks between checks while it plays.
  useEffect(() => {
    if (!status?.playing) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status])

  const act = (call: () => Promise<MusicStatus>): void => {
    call().then(setStatus).catch(log)
  }

  if (!status) return <div className={`music is-${size}`} />

  if (status.app !== 'ready') {
    return (
      <div className={`music is-${size} is-off`}>
        <span className="music-big-icon" aria-hidden>
          🎵
        </span>
        <p>
          {status.app === 'not-installed'
            ? t(
                'Para poner música desde aquí, instala la app de Spotify.',
                'To play music from here, install the Spotify app.'
              )
            : status.app === 'denied'
              ? t(
                  'Permite que Nuggit controle Spotify en Ajustes del Sistema → Privacidad y seguridad → Automatización.',
                  'Let Nuggit control Spotify in System Settings → Privacy & Security → Automation.'
                )
              : t('Spotify está cerrado.', 'Spotify is closed.')}
        </p>
        {status.app === 'closed' && (
          <button
            className="button-primary"
            onClick={() => window.api.music.openSpotify().then(refresh).catch(log)}
          >
            {t('Abrir Spotify', 'Open Spotify')}
          </button>
        )}
      </div>
    )
  }

  const position = Math.min(
    (status.position ?? 0) + (status.playing ? Math.max(0, now - at) / 1000 : 0),
    status.duration ?? Infinity
  )
  const shownVolume = volume ?? status.volume ?? 50

  const changeVolume = (value: number): void => {
    setVolume(value)
    if (volumeTimer.current) clearTimeout(volumeTimer.current)
    volumeTimer.current = setTimeout(() => {
      window.api.music
        .setVolume(value)
        .then((next) => {
          setVolume(null)
          setStatus(next)
        })
        .catch(log)
    }, VOLUME_DELAY_MS)
  }

  // The saved playlists, plus the Focus ones if they aren't among them.
  const music = settings?.music
  const saved = [
    ...(music?.playlists ?? []),
    ...[
      { uri: music?.focusPlaylist, name: t('Playlist de Focus', 'Focus playlist') },
      { uri: music?.breakPlaylist, name: t('Playlist de descanso', 'Break playlist') }
    ].filter(
      (p): p is SavedPlaylist => Boolean(p.uri) && !music?.playlists.some((s) => s.uri === p.uri)
    )
  ]

  return (
    <div className={`music is-${size}`}>
      {choosing ? (
        <PlaylistChooser
          playlists={saved}
          onClose={() => setChoosing(false)}
          onPlayed={() => {
            setChoosing(false)
            setTimeout(refresh, 600)
          }}
        />
      ) : (
        <>
          <div className="music-now">
            {status.artwork ? (
              <img className="music-cover" src={status.artwork} alt="" />
            ) : (
              <span className="music-cover is-empty" aria-hidden>
                🎵
              </span>
            )}
            <div className="music-song">
              <strong title={status.track ?? ''}>
                {status.track ?? t('Nada sonando', 'Nothing playing')}
              </strong>
              {status.artist && <small title={status.artist}>{status.artist}</small>}
            </div>
          </div>

          {status.duration ? (
            <div className="music-progress" aria-hidden>
              <small>{clock(position)}</small>
              <div className="music-bar">
                <div style={{ width: `${(position / status.duration) * 100}%` }} />
              </div>
              <small>{clock(status.duration)}</small>
            </div>
          ) : null}

          <div className="music-controls">
            <button
              className="icon-button"
              title={t('Anterior', 'Previous')}
              aria-label={t('Canción anterior', 'Previous song')}
              onClick={() => act(window.api.music.previous)}
            >
              ⏮
            </button>
            <button
              className="music-play"
              title={status.playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')}
              aria-label={status.playing ? t('Pausar', 'Pause') : t('Reproducir', 'Play')}
              onClick={() => act(window.api.music.playPause)}
            >
              {status.playing ? '⏸' : '▶'}
            </button>
            <button
              className="icon-button"
              title={t('Siguiente', 'Next')}
              aria-label={t('Siguiente canción', 'Next song')}
              onClick={() => act(window.api.music.next)}
            >
              ⏭
            </button>
          </div>

          <div className="music-footer">
            <label
              className="music-volume"
              title={t(`Volumen ${shownVolume}%`, `Volume ${shownVolume}%`)}
            >
              <span aria-hidden>{shownVolume === 0 ? '🔇' : '🔈'}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={shownVolume}
                aria-label={t('Volumen', 'Volume')}
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
            </label>
            <button className="button-ghost" onClick={() => setChoosing(true)}>
              🎶 Playlists
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// "Elegir playlist": the saved ones (and the Focus ones), and a box to save a new link.
function PlaylistChooser({
  playlists,
  onClose,
  onPlayed
}: {
  playlists: SavedPlaylist[]
  onClose(): void
  onPlayed(): void
}): React.JSX.Element {
  const [link, setLink] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const play = async (uri: string): Promise<void> => {
    setError(null)
    const result = await window.api.music.play(uri).catch(() => null)
    if (result?.ok) onPlayed()
    else setError(result?.error ?? t('No pude ponerla.', "Couldn't play it."))
  }

  const add = async (): Promise<void> => {
    if (!link.trim()) return
    setAdding(true)
    setError(null)
    const result = await window.api.music.addPlaylist(link).catch(() => null)
    setAdding(false)
    if (result?.ok) setLink('')
    else setError(result?.error ?? t('No pude guardarla.', "Couldn't save it."))
  }

  return (
    <div className="music-chooser">
      <div className="music-chooser-head">
        <strong>{t('🎶 Elegir playlist', '🎶 Choose a playlist')}</strong>
        <button className="icon-button" title={t('Volver', 'Back')} onClick={onClose}>
          ×
        </button>
      </div>
      {playlists.length === 0 ? (
        <p className="music-hint">
          {t(
            'Pega abajo el link de una playlist de Spotify (··· → Compartir → Copiar enlace) y queda guardada aquí.',
            'Paste a Spotify playlist link below (··· → Share → Copy link) and it gets saved here.'
          )}
        </p>
      ) : (
        <ul className="music-list">
          {playlists.map((p) => (
            <li key={p.uri}>
              <button className="music-list-play" onClick={() => play(p.uri)}>
                {p.image ? (
                  <img src={p.image} alt="" />
                ) : (
                  <span className="music-list-art" aria-hidden>
                    🎵
                  </span>
                )}
                <span>{p.name}</span>
              </button>
              <button
                className="icon-button"
                title={t('Quitar de la lista', 'Remove from the list')}
                onClick={() => window.api.music.removePlaylist(p.uri).catch(log)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="music-add"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          value={link}
          placeholder="https://open.spotify.com/playlist/…"
          aria-label={t('Link de una playlist de Spotify', 'Spotify playlist link')}
          spellCheck={false}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="submit" className="button-ghost" disabled={!link.trim() || adding}>
          {adding ? t('Guardando…', 'Saving…') : t('Guardar', 'Save')}
        </button>
      </form>
      {error && <p className="music-error">{error}</p>}
    </div>
  )
}
