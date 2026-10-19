import { speak, useVoices } from '../voice/speech'
import type { SectionProps } from './shared'

const IS_MAC = navigator.userAgent.includes('Mac')
const SAMPLE = '¡Hola! Soy Dip. Así sueno cuando te contesto.'

// SPEC 9.10, basic voice: dictation to talk to Dip, and Dip answering out loud.
export function VoiceSettings({ settings, update }: SectionProps): React.JSX.Element {
  const voices = useVoices()
  const { voice } = settings

  return (
    <section className="settings-section">
      <h3>🎙️ Voz</h3>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={voice.speak}
          onChange={(e) => update({ voice: { speak: e.target.checked } })}
        />
        <span>
          Dip contesta hablando
          <small>
            Lee en voz alta sus respuestas en el chat, con la voz del sistema. También se prende y
            apaga con 🔊 en el chat.
          </small>
        </span>
      </label>

      <label className="settings-field">
        <span>Voz</span>
        <select
          className="settings-select"
          value={voice.voiceURI ?? ''}
          onChange={(e) => update({ voice: { voiceURI: e.target.value || null } })}
        >
          <option value="">Automática (según el idioma de la respuesta)</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        <small>Si eliges una en español, las respuestas en inglés usan otra voz en inglés.</small>
      </label>

      <label className="settings-field">
        <span>Velocidad: {voice.rate.toFixed(1)}×</span>
        <input
          type="range"
          className="settings-range"
          min={0.5}
          max={2}
          step={0.1}
          value={voice.rate}
          onChange={(e) => update({ voice: { rate: Number(e.target.value) } })}
        />
      </label>

      <div className="settings-row">
        <button className="button-ghost" onClick={() => speak(SAMPLE, voice)}>
          ▶ Probar
        </button>
      </div>

      {IS_MAC && (
        <div className="settings-subsection">
          <h4>🎤 Hablarle a Dip</h4>
          <p className="settings-hint">
            Usa el dictado de la Mac: toca 🎤 junto al chat (o en Brain Dump), o pulsa dos veces la
            tecla <kbd>Fn</kbd> (🌐) en cualquier campo de texto. Habla y vuelve a tocarla para
            terminar. Lo convierte en texto macOS; Nuggit no graba nada.
          </p>
          <p className="settings-hint">
            Si no pasa nada, actívalo en Ajustes del Sistema → Teclado → Dictado.
          </p>
          <div className="settings-row">
            <button
              className="button-ghost"
              onClick={() =>
                window.api.voice
                  .openDictationSettings()
                  .catch((err) => console.error('Could not open settings', err))
              }
            >
              Abrir ajustes de Dictado
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
