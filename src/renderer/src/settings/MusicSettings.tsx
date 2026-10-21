import { useEffect, useState } from 'react'
import type { MusicStatus } from '../../../shared/types'
import { spotifyUri } from '../../../shared/music'
import type { SectionProps } from './shared'

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
      <h3>🎵 Música en Focus</h3>
      <p className="settings-hint">
        Nuggit pone tu playlist de Spotify cuando empiezas a concentrarte, la pausa (o cambia) en el
        descanso y la para al terminar. Usa la app de Spotify de tu Mac: no hace falta iniciar
        sesión aquí ni tener Premium.
      </p>

      <div className={`ai-state${status?.app === 'ready' ? ' is-on' : ''}`}>
        <span className="ai-dot" aria-hidden />
        {!status
          ? 'Buscando Spotify…'
          : status.app === 'not-installed'
            ? 'Spotify no está instalado en esta Mac'
            : status.app === 'closed'
              ? 'Spotify está cerrado (ábrelo antes de concentrarte)'
              : status.app === 'denied'
                ? 'Falta permiso: Ajustes del Sistema → Privacidad → Automatización → Spotify'
                : 'Spotify está abierto y listo'}
      </div>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={music.enabled}
          onChange={(e) => update({ music: { enabled: e.target.checked } })}
        />
        <span>
          Poner música durante Focus
          <small>La primera vez, macOS pregunta si Nuggit puede controlar Spotify.</small>
        </span>
      </label>

      <PlaylistField
        label="Playlist para concentrarte"
        value={music.focusPlaylist}
        onSave={(link) => update({ music: { focusPlaylist: link } })}
      />

      <fieldset className="settings-choices">
        <legend>En el descanso</legend>
        <label>
          <input
            type="radio"
            name="music-break"
            checked={music.onBreak === 'pause'}
            onChange={() => update({ music: { onBreak: 'pause' } })}
          />
          Pausar la música
        </label>
        <label>
          <input
            type="radio"
            name="music-break"
            checked={music.onBreak === 'playlist'}
            onChange={() => update({ music: { onBreak: 'playlist' } })}
          />
          Poner otra playlist
        </label>
      </fieldset>
      {music.onBreak === 'playlist' && (
        <PlaylistField
          label="Playlist para el descanso"
          value={music.breakPlaylist}
          onSave={(link) => update({ music: { breakPlaylist: link } })}
        />
      )}

      <small className="settings-hint">
        Para copiar el link: en Spotify, en la playlist toca ··· → Compartir → Copiar enlace.
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
        ? { ok: true, text: '¡Sonando! 🎶' }
        : { ok: false, text: result?.error ?? 'No pude ponerla.' }
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
          ▶ Probar
        </button>
      </div>
      {!valid && (
        <small className="settings-status is-error">Ese no parece un link de Spotify.</small>
      )}
      {message && (
        <small className={`settings-status is-${message.ok ? 'ok' : 'error'}`}>
          {message.text}
        </small>
      )}
    </label>
  )
}
