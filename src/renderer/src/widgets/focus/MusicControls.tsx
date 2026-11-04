import { useCallback, useEffect, useState } from 'react'
import type { MusicStatus } from '../../../../shared/types'
import { useSettings } from '../../store/useSettings'
import { t } from '../../../../shared/i18n'

const POLL_MS = 4000
const log = (err: unknown): void => console.error('[music]', err)

// SPEC 9.19: ⏯ ⏭ and the song playing, in Focus. Only when music is
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
            ? t(
                'Instala Spotify para tener música en Focus.',
                'Install Spotify to have music in Focus.'
              )
            : status.app === 'denied'
              ? t(
                  'Permite que Nuggit controle Spotify (Ajustes del Sistema → Privacidad → Automatización).',
                  'Let Nuggit control Spotify (System Settings → Privacy → Automation).'
                )
              : t('Abre Spotify para que suene tu música.', 'Open Spotify to play your music.')}
        </span>
        {status.app === 'closed' && (
          <button
            className="button-ghost"
            onClick={() => window.api.music.openSpotify().then(refresh).catch(log)}
          >
            {t('Abrir Spotify', 'Open Spotify')}
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
          : t('Sin música', 'No music')}
      </span>
      <button
        className="icon-button"
        title={status.playing ? t('Pausar música', 'Pause music') : t('Poner música', 'Play music')}
        aria-label={
          status.playing ? t('Pausar música', 'Pause music') : t('Poner música', 'Play music')
        }
        onClick={() => window.api.music.playPause().then(setStatus).catch(log)}
      >
        {status.playing ? '⏸' : '▶'}
      </button>
      <button
        className="icon-button"
        title={t('Siguiente canción', 'Next song')}
        aria-label={t('Siguiente canción', 'Next song')}
        onClick={() => window.api.music.next().then(setStatus).catch(log)}
      >
        ⏭
      </button>
    </div>
  )
}
