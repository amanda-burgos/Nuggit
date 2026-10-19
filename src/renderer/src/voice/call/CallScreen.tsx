import { useEffect, useRef, useState } from 'react'
import type { VoiceSettings } from '../../../../shared/types'
import { CallEngine, INITIAL_CALL, type CallPhase, type CallState } from './callEngine'
import './call.css'

const LABELS: Partial<Record<CallPhase, string>> = {
  checking: 'Llamando a Dip…',
  connecting: 'Llamando a Dip…',
  listening: 'Te escucho…',
  hearing: 'Escuchando…',
  thinking: 'Pensando…',
  speaking: 'Dip está hablando · habla para interrumpir'
}

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
      aria-label="Llamada con Dip"
    >
      {phase === 'explain-mic' && (
        <div className="call-notice">
          <strong>🎤 Para hablar con Dip, Nuggit necesita tu micrófono.</strong>
          <p>
            Solo lo usa durante la llamada. Lo que dices se convierte en texto y el audio no se
            guarda. macOS te va a preguntar una sola vez.
          </p>
          <div className="call-buttons">
            <button
              className="button-primary"
              onClick={() => engine.current?.allowMic().catch(log)}
            >
              Permitir micrófono
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              Ahora no
            </button>
          </div>
        </div>
      )}

      {phase === 'mic-denied' && (
        <div className="call-notice">
          <strong>macOS no deja que Nuggit use el micrófono.</strong>
          <p>Actívalo en Ajustes del Sistema → Privacidad y seguridad → Micrófono.</p>
          <div className="call-buttons">
            <button
              className="button-primary"
              onClick={() => window.api.voice.openMicSettings().catch(log)}
            >
              Abrir Privacidad
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {phase === 'no-stt' && (
        <div className="call-notice">
          <strong>Dip todavía no puede entender tu voz.</strong>
          <p>
            Falta algo que convierta tu voz en texto: whisper.cpp en esta Mac (gratis y privado), tu
            servidor o Gemini. Se prepara en Ajustes → Voz → Modo llamada.
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
              Ir a Ajustes → Voz
            </button>
            <button className="button-ghost" onClick={onHangUp}>
              Cerrar
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
            {muted ? 'Silenciado' : LABELS[phase]}
          </p>
          <div className="call-transcript">
            {state.heard && (
              <p>
                <small>Tú</small> {state.heard}
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
              {muted ? '🎙️ Activar micrófono' : '🔇 Silenciar'}
            </button>
            <button className="call-hangup" onClick={onHangUp}>
              📞 Colgar
            </button>
          </div>
        </>
      )}

      {phase === 'checking' && <p className="call-state">{LABELS.checking}</p>}
    </div>
  )
}
