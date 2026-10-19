import { useState } from 'react'
import {
  bestVoice,
  hasGoodVoice,
  sortVoices,
  voiceFor,
  type SystemVoice,
  type VoiceQuality
} from '../../../shared/voices'
import { speak, stopSpeaking, useSystemVoices } from '../voice/speech'
import type { SectionProps } from './shared'

const IS_MAC = navigator.userAgent.includes('Mac')
const SAMPLES = {
  es: '¡Hola! Soy Dip. Así sueno cuando te contesto. ¿Empezamos con algo chiquito?',
  en: "Hi! I'm Dip. This is how I sound when I answer you. Shall we start with something small?"
}

const QUALITY_LABELS: Record<VoiceQuality, string> = {
  premium: '⭐ Premium',
  enhanced: '✨ Mejorada',
  standard: '',
  basic: 'robótica'
}

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

function describe(voice: SystemVoice): string {
  const region = voice.lang.split('-')[1]
  const where = region ? regionNames.of(region.toUpperCase()) : voice.lang
  const quality = QUALITY_LABELS[voice.quality]
  return `${voice.name} — ${where}${quality ? ` · ${quality}` : ''}`
}

// SPEC 9.10, basic voice: dictation to talk to Dip, and Dip answering out loud with the
// voice chosen here (by default, the best Spanish one installed).
export function VoiceSettings({ settings, update }: SectionProps): React.JSX.Element {
  const { voices, refresh } = useSystemVoices()
  const [refreshing, setRefreshing] = useState(false)
  const { voice } = settings

  const sorted = sortVoices(voices ?? [])
  const spanish = sorted.filter((v) => v.lang.startsWith('es'))
  const english = sorted.filter((v) => v.lang.startsWith('en'))
  const best = bestVoice(voices ?? [], 'es', navigator.language)
  const chosen = sorted.find((v) => v.id === voice.voiceURI)
  // What "▶ Probar" says: a sample in the language of the voice that will be used.
  const testVoice = chosen ?? voiceFor(voices ?? [], undefined, 'es', navigator.language)
  const sampleLang: 'es' | 'en' = testVoice?.lang.startsWith('en') ? 'en' : 'es'

  const test = (): void => {
    speak(SAMPLES[sampleLang], voice).catch((err) => console.error('Could not test voice', err))
  }

  const reload = async (): Promise<void> => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

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
            Lee en voz alta sus respuestas en el chat, con una voz del sistema. También se prende y
            apaga con 🔊 en el chat.
          </small>
        </span>
      </label>

      {IS_MAC && (
        <label className="settings-field">
          <span>Voz</span>
          <select
            className="settings-select voice-select"
            value={chosen ? chosen.id : ''}
            disabled={!voices}
            onChange={(e) => {
              stopSpeaking()
              update({ voice: { voiceURI: e.target.value || null } })
            }}
          >
            <option value="">
              {voices
                ? `La mejor disponible${best ? ` (ahora: ${describe(best)})` : ''}`
                : 'Buscando voces…'}
            </option>
            {spanish.length > 0 && (
              <optgroup label="Español">
                {spanish.map((v) => (
                  <option key={v.id} value={v.id}>
                    {describe(v)}
                  </option>
                ))}
              </optgroup>
            )}
            {english.length > 0 && (
              <optgroup label="English">
                {english.map((v) => (
                  <option key={v.id} value={v.id}>
                    {describe(v)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <small>
            Las respuestas en inglés usan la mejor voz en inglés si la elegida es en español (y al
            revés).
          </small>
        </label>
      )}

      {IS_MAC && voices && !hasGoodVoice(voices, 'es') && (
        <div className="settings-guide voice-tip">
          <p>
            <strong>Tu Mac no tiene voces Mejoradas ni Premium en español</strong>, por eso Dip
            suena robótico. Son gratis:
          </p>
          <ol>
            <li>Ajustes del Sistema → Accesibilidad → Contenido leído.</li>
            <li>En “Voz del sistema”, abre la lista y elige “Administrar voces…”.</li>
            <li>
              Busca <em>Español</em> y descarga una “(Mejorada)” o “(Premium)” (por ejemplo Paulina
              o Mónica).
            </li>
            <li>Vuelve aquí y toca “Actualizar voces”.</li>
          </ol>
          <div className="settings-row">
            <button
              className="button-ghost"
              onClick={() =>
                window.api.voice
                  .openVoiceSettings()
                  .catch((err) => console.error('Could not open settings', err))
              }
            >
              Abrir Accesibilidad
            </button>
            <button className="button-ghost" disabled={refreshing} onClick={reload}>
              {refreshing ? 'Buscando…' : 'Actualizar voces'}
            </button>
          </div>
        </div>
      )}

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

      <label className="settings-field">
        <span>
          Tono: {voice.pitch === 1 ? 'normal' : voice.pitch < 1 ? 'más grave' : 'más agudo'}
        </span>
        <input
          type="range"
          className="settings-range"
          min={0.8}
          max={1.25}
          step={0.05}
          value={voice.pitch}
          onChange={(e) => update({ voice: { pitch: Number(e.target.value) } })}
        />
      </label>

      <div className="settings-row">
        <button className="button-ghost" onClick={test}>
          ▶ Probar
        </button>
        <button className="button-ghost" onClick={stopSpeaking}>
          ⏹ Parar
        </button>
        {IS_MAC && voices && hasGoodVoice(voices, 'es') && (
          <button className="button-ghost" disabled={refreshing} onClick={reload}>
            {refreshing ? 'Buscando…' : 'Actualizar voces'}
          </button>
        )}
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
