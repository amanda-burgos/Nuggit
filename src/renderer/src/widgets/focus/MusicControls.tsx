import { useCallback, useEffect, useState } from 'react'
import type { MusicStatus } from '../../../../shared/types'
import { useSettings } from '../../store/useSettings'

const POLL_MS = 4000
const log = (err: unknown): void => console.error('[music]', err)

// SPEC 9.19: ⏯ ⏭ and the song playing, in Focus and in Lockdown. Only when music is
// turned on in Ajustes → Música. Without Spotify open, a kind note instead.
export function MusicControls(): React.JSX.Element | null {
  const { settings } = useSettings()
  const enabled = Boolean(settings?.music.enabled && settings.music.focusPlaylist)
  const [status, setStatus] = useState<MusicStatus | null>(null)

  const refresh = useCallback(() => {
    window.api.music.status().then(setStatus).catch(log)
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  if (!enabled || !status) return null

  if (status.app !== 'ready') {
    return (
      <div className="focus-music is-off">
        <span>
          🎵{' '}
          {status.app === 'not-installed'
            ? 'Instala Spotify para tener música en Focus.'
            : status.app === 'denied'
              ? 'Permite que Nuggit controle Spotify (Ajustes del Sistema → Privacidad → Automatización).'
              : 'Abre Spotify para que suene tu música.'}
        </span>
        {status.app === 'closed' && (
          <button
            className="button-ghost"
            onClick={() => window.api.music.openSpotify().then(refresh).catch(log)}
          >
            Abrir Spotify
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="focus-music">
      <span
        className="focus-music-song"
        title={[status.track, status.artist].filter(Boolean).join(' · ')}
      >
        🎵{' '}
        {status.track
          ? `${status.track}${status.artist ? ` · ${status.artist}` : ''}`
          : 'Sin música'}
      </span>
      <button
        className="icon-button"
        title={status.playing ? 'Pausar música' : 'Poner música'}
        aria-label={status.playing ? 'Pausar música' : 'Poner música'}
        onClick={() => window.api.music.playPause().then(setStatus).catch(log)}
      >
        {status.playing ? '⏸' : '▶'}
      </button>
      <button
        className="icon-button"
        title="Siguiente canción"
        aria-label="Siguiente canción"
        onClick={() => window.api.music.next().then(setStatus).catch(log)}
      >
        ⏭
      </button>
    </div>
  )
}
