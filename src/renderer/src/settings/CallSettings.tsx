import { useCallback, useEffect, useState } from 'react'
import type { ModelDownload, SttBackend, SttStatus } from '../../../shared/types'
import type { SectionProps } from './shared'
import { t } from '../../../shared/i18n'

const providers = (): Array<{ value: 'auto' | SttBackend; label: string }> => [
  {
    value: 'auto',
    label: t(
      '✨ Automático (el primero que esté listo)',
      '✨ Automatic (the first one that’s ready)'
    )
  },
  {
    value: 'whisper',
    label: t(
      '🏠 whisper.cpp en esta Mac (gratis y privado)',
      '🏠 whisper.cpp on this Mac (free and private)'
    )
  },
  {
    value: 'custom',
    label: t('🖥️ Tu servidor (si transcribe audio)', '🖥️ Your server (if it transcribes audio)')
  },
  { value: 'gemini', label: '☁️ Gemini' }
]

const names = (): Record<SttBackend, string> => ({
  whisper: t('whisper.cpp en esta Mac', 'whisper.cpp on this Mac'),
  custom: t('tu servidor', 'your server'),
  gemini: 'Gemini'
})

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
      <h3>📞 {t('Modo llamada', 'Call mode')}</h3>
      <p className="settings-hint">
        {t(
          'Toca 📞 en el chat de Dip para hablar con él manos libres: te escucha, nota cuando terminas de hablar, contesta en voz alta, y si le hablas mientras habla, se calla y te escucha.',
          "Tap 📞 in Dip's chat to talk to it hands-free: it listens, notices when you're done talking, answers out loud, and if you talk while it's talking, it stops and listens."
        )}
      </p>

      <div className={`ai-state${status?.active ? ' is-on' : ''}`}>
        <span className="ai-dot" aria-hidden />
        {!status
          ? t('Revisando…', 'Checking…')
          : status.active
            ? t(
                `Dip te entiende con ${names()[status.active]}`,
                `Dip understands you with ${names()[status.active]}`
              )
            : t(
                'Todavía falta algo que entienda tu voz (abajo)',
                'You still need something that understands your voice (below)'
              )}
      </div>

      <label className="settings-field">
        <span>{t('Quién convierte tu voz en texto', 'What turns your voice into text')}</span>
        <select
          className="settings-select"
          value={voice.stt ?? 'auto'}
          disabled={status?.fromEnv}
          onChange={(e) => update({ voice: { stt: e.target.value as 'auto' | SttBackend } })}
        >
          {providers().map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {status?.fromEnv && (
          <small>
            {t('Fijado en .env (NUGGIT_STT_PROVIDER).', 'Set in .env (NUGGIT_STT_PROVIDER).')}
          </small>
        )}
      </label>

      <div className="settings-subsection">
        <h4>🏠 whisper.cpp</h4>
        {!status ? null : whisper?.bin ? (
          <p className="settings-hint">
            ✓ {t('Instalado', 'Installed')} ({whisper.bin}).
          </p>
        ) : (
          <p className="settings-hint">
            {t('No está instalado. En la Terminal:', "It isn't installed. In Terminal:")}{' '}
            <code>brew install whisper-cpp</code> {t('(necesita', '(needs')}{' '}
            <a href="https://brew.sh" target="_blank" rel="noreferrer">
              Homebrew
            </a>
            {t('). Luego vuelve aquí.', '). Then come back here.')}
          </p>
        )}
        <label className="settings-field">
          <span>{t('Modelo', 'Model')}</span>
          <select
            className="settings-select"
            value={voice.whisperModel ?? 'base'}
            disabled={downloading}
            onChange={(e) =>
              update({ voice: { whisperModel: e.target.value as 'base' | 'small' } })
            }
          >
            <option value="base">{t('Base · 148 MB · rápido', 'Base · 148 MB · fast')}</option>
            <option value="small">
              {t('Small · 488 MB · entiende mejor', 'Small · 488 MB · understands better')}
            </option>
          </select>
        </label>
        {whisper?.modelReady ? (
          <p className="settings-hint">✓ {t('Modelo listo.', 'Model ready.')}</p>
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
                ? `${t('Bajando…', 'Downloading…')} ${Math.round((download.progress ?? 0) * 100)}%`
                : t(
                    `Bajar modelo (${whisper?.modelSizeMB ?? 148} MB)`,
                    `Download model (${whisper?.modelSizeMB ?? 148} MB)`
                  )}
            </button>
            {download?.state === 'error' && (
              <span className="settings-status is-error">{download.error}</span>
            )}
          </div>
        )}
        <small className="settings-hint">
          {t(
            'Se baja una sola vez a la carpeta de Nuggit. Tu voz nunca sale de la Mac.',
            "It downloads just once into Nuggit's folder. Your voice never leaves the Mac."
          )}
        </small>
        <button className="button-ghost settings-inline-button" onClick={refresh}>
          {t('Volver a revisar', 'Check again')}
        </button>
      </div>

      <label className="settings-field">
        <span>{t('Idioma de la llamada', 'Call language')}</span>
        <select
          className="settings-select"
          value={voice.callLang ?? 'auto'}
          onChange={(e) => update({ voice: { callLang: e.target.value as 'auto' | 'es' | 'en' } })}
        >
          <option value="auto">{t('Automático', 'Automatic')}</option>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <small>
          {t(
            'Elegir uno ayuda si a veces te entiende en el idioma equivocado.',
            'Picking one helps if it sometimes hears you in the wrong language.'
          )}
        </small>
      </label>

      <p className="settings-hint">
        {t('Tu servidor sirve si tiene', 'Your server works if it has')}{' '}
        <code>/audio/transcriptions</code>{' '}
        {t(
          '(como la API de OpenAI). Gemini usa tu key guardada. Se puede fijar en .env con',
          '(like the OpenAI API). Gemini uses your saved key. You can set it in .env with'
        )}{' '}
        <code>NUGGIT_STT_PROVIDER</code>.
      </p>
    </section>
  )
}
