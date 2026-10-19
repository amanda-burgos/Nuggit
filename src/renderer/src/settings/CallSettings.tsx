import { useCallback, useEffect, useState } from 'react'
import type { ModelDownload, SttBackend, SttStatus } from '../../../shared/types'
import type { SectionProps } from './shared'

const PROVIDERS: Array<{ value: 'auto' | SttBackend; label: string }> = [
  { value: 'auto', label: '✨ Automático (el primero que esté listo)' },
  { value: 'whisper', label: '🏠 whisper.cpp en esta Mac (gratis y privado)' },
  { value: 'custom', label: '🖥️ Tu servidor (si transcribe audio)' },
  { value: 'gemini', label: '☁️ Gemini' }
]

const NAMES: Record<SttBackend, string> = {
  whisper: 'whisper.cpp en esta Mac',
  custom: 'tu servidor',
  gemini: 'Gemini'
}

const log = (err: unknown): void => console.error('[call settings]', err)

// SPEC 9.10, call mode: what turns your voice into text (configurable like the AI, 8.1).
export function CallSettings({ settings, update }: SectionProps): React.JSX.Element {
  const [status, setStatus] = useState<SttStatus | null>(null)
  const [download, setDownload] = useState<ModelDownload | null>(null)
  const { voice } = settings

  const refresh = useCallback(() => {
    window.api.voice.sttStatus().then(setStatus).catch(log)
  }, [])

  // Reloaded when the choice changes here or a download ends.
  useEffect(refresh, [refresh, voice.stt, voice.whisperModel])
  useEffect(
    () =>
      window.api.voice.onModelDownload((progress) => {
        setDownload(progress)
        if (progress.state !== 'downloading') refresh()
      }),
    [refresh]
  )

  const whisper = status?.whisper
  const downloading = download?.state === 'downloading'

  return (
    <section className="settings-section">
      <h3>📞 Modo llamada</h3>
      <p className="settings-hint">
        Toca 📞 en el chat de Dip para hablar con él manos libres: te escucha, nota cuando terminas
        de hablar, contesta en voz alta, y si le hablas mientras habla, se calla y te escucha.
      </p>

      <div className={`ai-state${status?.active ? ' is-on' : ''}`}>
        <span className="ai-dot" aria-hidden />
        {!status
          ? 'Revisando…'
          : status.active
            ? `Dip te entiende con ${NAMES[status.active]}`
            : 'Todavía falta algo que entienda tu voz (abajo)'}
      </div>

      <label className="settings-field">
        <span>Quién convierte tu voz en texto</span>
        <select
          className="settings-select"
          value={voice.stt ?? 'auto'}
          disabled={status?.fromEnv}
          onChange={(e) => update({ voice: { stt: e.target.value as 'auto' | SttBackend } })}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {status?.fromEnv && <small>Fijado en .env (NUGGIT_STT_PROVIDER).</small>}
      </label>

      <div className="settings-subsection">
        <h4>🏠 whisper.cpp</h4>
        {!status ? null : whisper?.bin ? (
          <p className="settings-hint">✓ Instalado ({whisper.bin}).</p>
        ) : (
          <p className="settings-hint">
            No está instalado. En la Terminal: <code>brew install whisper-cpp</code> (necesita{' '}
            <a href="https://brew.sh" target="_blank" rel="noreferrer">
              Homebrew
            </a>
            ). Luego vuelve aquí.
          </p>
        )}
        <label className="settings-field">
          <span>Modelo</span>
          <select
            className="settings-select"
            value={voice.whisperModel ?? 'base'}
            disabled={downloading}
            onChange={(e) =>
              update({ voice: { whisperModel: e.target.value as 'base' | 'small' } })
            }
          >
            <option value="base">Base · 148 MB · rápido</option>
            <option value="small">Small · 488 MB · entiende mejor</option>
          </select>
        </label>
        {whisper?.modelReady ? (
          <p className="settings-hint">✓ Modelo listo.</p>
        ) : (
          <div className="settings-row is-centered">
            <button
              className="button-primary"
              disabled={downloading}
              onClick={() => {
                setDownload({ state: 'downloading', progress: 0 })
                window.api.voice.downloadModel().catch(log)
              }}
            >
              {downloading
                ? `Bajando… ${Math.round((download.progress ?? 0) * 100)}%`
                : `Bajar modelo (${whisper?.modelSizeMB ?? 148} MB)`}
            </button>
            {download?.state === 'error' && (
              <span className="settings-status is-error">{download.error}</span>
            )}
          </div>
        )}
        <small className="settings-hint">
          Se baja una sola vez a la carpeta de Nuggit. Tu voz nunca sale de la Mac.
        </small>
        <button className="button-ghost settings-inline-button" onClick={refresh}>
          Volver a revisar
        </button>
      </div>

      <label className="settings-field">
        <span>Idioma de la llamada</span>
        <select
          className="settings-select"
          value={voice.callLang ?? 'auto'}
          onChange={(e) => update({ voice: { callLang: e.target.value as 'auto' | 'es' | 'en' } })}
        >
          <option value="auto">Automático</option>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <small>Elegir uno ayuda si a veces te entiende en el idioma equivocado.</small>
      </label>

      <p className="settings-hint">
        Tu servidor sirve si tiene <code>/audio/transcriptions</code> (como la API de OpenAI).
        Gemini usa tu key guardada. Se puede fijar en .env con <code>NUGGIT_STT_PROVIDER</code>.
      </p>
    </section>
  )
}
