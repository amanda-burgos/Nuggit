import { useEffect, useState } from 'react'
import type { MusicStatus } from '../../../shared/types'
import { spotifyUri } from '../../../shared/music'
import type { SectionProps } from './shared'
import { t } from '../../../shared/i18n'

const log = (err: unknown): void => console.error('[music settings]', err)

// The URI back as a link people recognize.
const asLink = (uri: string | undefined): string => {
  if (!uri) return ''
  const [, kind, id] = uri.split(':')
  return `https://open.spotify.com/${kind}/${id}`
}

// SPEC 9.19, Paso 1: music while Focus runs, with the Spotify app on this Mac.
export function MusicSettings({ settings, update }: SectionProps): React.JSX.Element {
  const { music } = settings
  const [status, setStatus] = useState<MusicStatus | null>(null)

  useEffect(() => {
    window.api.music.status(false).then(setStatus).catch(log)
  }, [])

  return (
    <section className="settings-section">
      <h3>🎵 {t('Música en Focus', 'Music in Focus')}</h3>
      <p className="settings-hint">
        {t(
          'Nuggit pone tu playlist de Spotify cuando empiezas a concentrarte, la pausa (o cambia) en el descanso y la para al terminar. Usa la app de Spotify de tu Mac: no hace falta iniciar sesión aquí ni tener Premium.',
          "Nuggit plays your Spotify playlist when you start focusing, pauses (or switches) it on your break and stops it when you're done. It uses the Spotify app on your Mac: no need to sign in here or have Premium."
        )}
      </p>

      <div className={`ai-state${status?.app === 'ready' ? ' is-on' : ''}`}>
        <span className="ai-dot" aria-hidden />
        {!status
          ? t('Buscando Spotify…', 'Looking for Spotify…')
          : status.app === 'not-installed'
            ? t('Spotify no está instalado en esta Mac', "Spotify isn't installed on this Mac")
            : status.app === 'closed'
              ? t(
                  'Spotify está cerrado (ábrelo antes de concentrarte)',
                  'Spotify is closed (open it before you focus)'
                )
              : status.app === 'denied'
                ? t(
                    'Falta permiso: Ajustes del Sistema → Privacidad → Automatización → Spotify',
                    'Permission needed: System Settings → Privacy → Automation → Spotify'
                  )
                : t('Spotify está abierto y listo', 'Spotify is open and ready')}
      </div>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={music.enabled}
          onChange={(e) => update({ music: { enabled: e.target.checked } })}
        />
        <span>
          {t('Poner música durante Focus', 'Play music during Focus')}
          <small>
            {t(
              'La primera vez, macOS pregunta si Nuggit puede controlar Spotify.',
              'The first time, macOS asks if Nuggit can control Spotify.'
            )}
          </small>
        </span>
      </label>

      <PlaylistField
        label={t('Playlist para concentrarte', 'Playlist for focusing')}
        value={music.focusPlaylist}
        onSave={(link) => update({ music: { focusPlaylist: link } })}
      />

      <fieldset className="settings-choices">
        <legend>{t('En el descanso', 'On the break')}</legend>
        <label>
          <input
            type="radio"
            name="music-break"
            checked={music.onBreak === 'pause'}
            onChange={() => update({ music: { onBreak: 'pause' } })}
          />
          {t('Pausar la música', 'Pause the music')}
        </label>
        <label>
          <input
            type="radio"
            name="music-break"
            checked={music.onBreak === 'playlist'}
            onChange={() => update({ music: { onBreak: 'playlist' } })}
          />
          {t('Poner otra playlist', 'Play another playlist')}
        </label>
      </fieldset>
      {music.onBreak === 'playlist' && (
        <PlaylistField
          label={t('Playlist para el descanso', 'Playlist for the break')}
          value={music.breakPlaylist}
          onSave={(link) => update({ music: { breakPlaylist: link } })}
        />
      )}

      <small className="settings-hint">
        {t(
          'Para copiar el link: en Spotify, en la playlist toca ··· → Compartir → Copiar enlace.',
          'To copy the link: in Spotify, on the playlist tap ··· → Share → Copy link.'
        )}
      </small>
    </section>
  )
}

function PlaylistField({
  label,
  value,
  onSave
}: {
  label: string
  value: string | undefined
  onSave(link: string | null): void
}): React.JSX.Element {
  const [input, setInput] = useState(asLink(value))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const valid = !input.trim() || spotifyUri(input) !== null

  const save = (): void => {
    if (!valid) return
    if ((spotifyUri(input) ?? '') !== (value ?? '')) onSave(input.trim() || null)
  }

  const test = async (): Promise<void> => {
    setMessage(null)
    const result = await window.api.music.play(input).catch(() => null)
    setMessage(
      result?.ok
        ? { ok: true, text: t('¡Sonando! 🎶', 'Playing! 🎶') }
        : { ok: false, text: result?.error ?? t('No pude ponerla.', "I couldn't play it.") }
    )
  }

  return (
    <label className="settings-field">
      <span>{label}</span>
      <div className="settings-row">
        <input
          className="settings-input"
          value={input}
          placeholder="https://open.spotify.com/playlist/…"
          spellCheck={false}
          onChange={(e) => {
            setInput(e.target.value)
            setMessage(null)
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
        <button
          type="button"
          className="button-ghost"
          disabled={!input.trim() || !valid}
          onClick={test}
        >
          ▶ {t('Probar', 'Test')}
        </button>
      </div>
      {!valid && (
        <small className="settings-status is-error">
          {t('Ese no parece un link de Spotify.', "That doesn't look like a Spotify link.")}
        </small>
      )}
      {message && (
        <small className={`settings-status is-${message.ok ? 'ok' : 'error'}`}>
          {message.text}
        </small>
      )}
    </label>
  )
}
