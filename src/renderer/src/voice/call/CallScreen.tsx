import { useEffect, useRef, useState } from 'react'
import type { VoiceSettings } from '../../../../shared/types'
import { CallEngine, INITIAL_CALL, type CallPhase, type CallState } from './callEngine'
import './call.css'
import { t } from '../../../../shared/i18n'

const labels = (): Partial<Record<CallPhase, string>> => ({
  checking: t('Llamando a Dip…', 'Calling Dip…'),
  connecting: t('Llamando a Dip…', 'Calling Dip…'),
  listening: t('Te escucho…', "I'm listening…"),
  hearing: t('Escuchando…', 'Listening…'),
  thinking: t('Pensando…', 'Thinking…'),
  speaking: t('Dip está hablando · habla para interrumpir', 'Dip is talking · talk to interrupt')
})

const log = (err: unknown): void => console.error('[call]', err)

// SPEC 9.10: the little call screen. The circle follows your voice; states, mute and
// hang up. Closing it (or the window) ends the call.
export function CallScreen({
  voice,
  onHangUp
}: {
  voice: VoiceSettings
  onHangUp(): void
}): React.JSX.Element {
  const [state, setState] = useState<CallState>(INITIAL_CALL)
  const engine = useRef<CallEngine | null>(null)
  const voiceRef = useRef(voice)

  useEffect(() => {
    voiceRef.current = voice
  }, [voice])

  useEffect(() => {
    const call = new CallEngine(setState, () => voiceRef.current)
    engine.current = call
    call.start().catch(log)
    return () => call.close()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onHangUp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHangUp])

  const { phase, muted, level } = state
  const inCall = !['checking', 'explain-mic', 'mic-denied', 'no-stt'].includes(phase)
  const scale = phase === 'hearing' || phase === 'listening' ? 1 + level * 0.6 : 1

  return (
    <div
      className={`call is-${phase}${muted ? ' is-muted' : ''}`}
      role="dialog"
      aria-label={t('Llamada con Dip', 'Call with Dip')}
    >
      {phase === 'explain-mic' && (
        <div className="call-notice">
          <strong>
            🎤{' '}
            {t(
              'Para hablar con Dip, Nuggit necesita tu micrófono.',
              'To talk to Dip, Nuggit needs your microphone.'
            )}
          </strong>
          <p>
            {t(
              'Solo lo usa durante la llamada. Lo que dices se convierte en texto y el audio no se guarda. macOS te va a preguntar una sola vez.',
              "It only uses it during the call. What you say is turned into text and the audio isn't saved. macOS will ask you just once."
            )}
          </p>
          <div className="call-buttons">
            <button
              className="button-primary"
              onClick={() => engine.current?.allowMic().catch(log)}
            >
              {t('Permitir micrófono', 'Allow microphone')}
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              {t('Ahora no', 'Not now')}
            </button>
          </div>
        </div>
      )}

      {phase === 'mic-denied' && (
        <div className="call-notice">
          <strong>
            {t(
              'macOS no deja que Nuggit use el micrófono.',
              "macOS isn't letting Nuggit use the microphone."
            )}
          </strong>
          <p>
            {t(
              'Actívalo en Ajustes del Sistema → Privacidad y seguridad → Micrófono.',
              'Turn it on in System Settings → Privacy & Security → Microphone.'
            )}
          </p>
          <div className="call-buttons">
            <button
              className="button-primary"
              onClick={() => window.api.voice.openMicSettings().catch(log)}
            >
              {t('Abrir Privacidad', 'Open Privacy')}
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              {t('Cerrar', 'Close')}
            </button>
          </div>
        </div>
      )}

      {phase === 'no-stt' && (
        <div className="call-notice">
          <strong>
            {t('Dip todavía no puede entender tu voz.', "Dip can't understand your voice yet.")}
          </strong>
          <p>
            {t(
              'Falta algo que convierta tu voz en texto: whisper.cpp en esta Mac (gratis y privado), tu servidor o Gemini. Se prepara en Ajustes → Voz → Modo llamada.',
              'It needs something that turns your voice into text: whisper.cpp on this Mac (free and private), your server or Gemini. Set it up in Settings → Voice → Call mode.'
            )}
          </p>
          <div className="call-buttons">
            <button
              className="button-primary"
              onClick={() => {
                window.api.settings.update({ ui: { settingsTab: 'voice' } }).catch(log)
                window.api.app.openSettings()
                onHangUp()
              }}
            >
              {t('Ir a Ajustes → Voz', 'Go to Settings → Voice')}
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              {t('Cerrar', 'Close')}
            </button>
          </div>
        </div>
      )}

      {inCall && (
        <>
          <div className="call-orb-wrap" aria-hidden>
            <div className="call-orb" style={{ transform: `scale(${scale.toFixed(3)})` }} />
          </div>
          <p className="call-state" aria-live="polite">
            {muted ? t('Silenciado', 'Muted') : labels()[phase]}
          </p>
          <div className="call-transcript">
            {state.heard && (
              <p>
                <small>{t('Tú', 'You')}</small> {state.heard}
              </p>
            )}
            {state.said && (
              <p>
                <small>Dip</small> {state.said}
              </p>
            )}
            {state.error && <p className="call-error">{state.error}</p>}
          </div>
          <div className="call-buttons">
            <button
              className="button-ghost call-mute"
              aria-pressed={muted}
              onClick={() => engine.current?.toggleMute()}
            >
              {muted ? t('🎙️ Activar micrófono', '🎙️ Unmute') : t('🔇 Silenciar', '🔇 Mute')}
            </button>
            <button className="call-hangup" onClick={onHangUp}>
              📞 {t('Colgar', 'Hang up')}
            </button>
          </div>
        </>
      )}

      {phase === 'checking' && <p className="call-state">{labels().checking}</p>}
    </div>
  )
}
