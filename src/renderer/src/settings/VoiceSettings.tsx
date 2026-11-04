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
import { locale, t } from '../../../shared/i18n'

const IS_MAC = navigator.userAgent.includes('Mac')
const SAMPLES = {
  es: '¡Hola! Soy Dip. Así sueno cuando te contesto. ¿Empezamos con algo chiquito?',
  en: "Hi! I'm Dip. This is how I sound when I answer you. Shall we start with something small?"
}

const qualityLabels = (): Record<VoiceQuality, string> => ({
  premium: '⭐ Premium',
  enhanced: t('✨ Mejorada', '✨ Enhanced'),
  standard: '',
  basic: t('robótica', 'robotic')
})

function describe(voice: SystemVoice): string {
  const region = voice.lang.split('-')[1]
  const regionNames = new Intl.DisplayNames([locale()], { type: 'region' })
  const where = region ? regionNames.of(region.toUpperCase()) : voice.lang
  const quality = qualityLabels()[voice.quality]
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

  // ▶ next to a voice: a sample in that voice, with the current speed and pitch.
  const play = (v: SystemVoice | undefined): void => {
    if (!v) return test()
    const lang = v.lang.startsWith('en') ? 'en' : 'es'
    speak(SAMPLES[lang], { ...voice, voiceURI: v.id }).catch((err) =>
      console.error('Could not play voice', err)
    )
  }

  const reload = async (): Promise<void> => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  return (
    <section className="settings-section">
      <h3>🎙️ {t('Voz', 'Voice')}</h3>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={voice.speak}
          onChange={(e) => update({ voice: { speak: e.target.checked } })}
        />
        <span>
          {t('Dip contesta hablando', 'Dip answers out loud')}
          <small>
            {t(
              'Lee en voz alta sus respuestas en el chat, con una voz del sistema. También se prende y apaga con 🔊 en el chat.',
              'It reads its chat answers out loud, with a system voice. You can also turn it on and off with 🔊 in the chat.'
            )}
          </small>
        </span>
      </label>

      {IS_MAC && (
        <div className="settings-field">
          <span>{t('Voz', 'Voice')}</span>
          <div className="voice-list" role="radiogroup" aria-label={t('Voz de Dip', "Dip's voice")}>
            <VoiceRow
              label={
                voices
                  ? t('La mejor disponible', 'The best available')
                  : t('Buscando voces…', 'Looking for voices…')
              }
              detail={best ? `${t('ahora', 'now')}: ${describe(best)}` : undefined}
              checked={!chosen}
              onChoose={() => update({ voice: { voiceURI: null } })}
              onPlay={() => play(best)}
            />
            {[
              { title: 'Español', list: spanish, open: true },
              { title: 'English', list: english, open: false }
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <details
                    key={group.title}
                    className="voice-group"
                    open={group.open || group.list.includes(chosen!)}
                  >
                    <summary>
                      {group.title} ({group.list.length})
                    </summary>
                    {group.list.map((v) => (
                      <VoiceRow
                        key={v.id}
                        label={describe(v)}
                        checked={chosen?.id === v.id}
                        onChoose={() => update({ voice: { voiceURI: v.id } })}
                        onPlay={() => play(v)}
                      />
                    ))}
                  </details>
                )
            )}
          </div>
          <small>
            {t(
              'Las respuestas en inglés usan la mejor voz en inglés si la elegida es en español (y al revés).',
              'Answers in English use the best English voice if the chosen one is Spanish (and the other way around).'
            )}
          </small>
        </div>
      )}

      {IS_MAC && voices && !hasGoodVoice(voices, 'es') && (
        <div className="settings-guide voice-tip">
          <p>
            <strong>
              {t(
                'Tu Mac no tiene voces Mejoradas ni Premium en español',
                "Your Mac doesn't have Enhanced or Premium Spanish voices"
              )}
            </strong>
            {t(
              ', por eso Dip suena robótico. Son gratis:',
              ", that's why Dip sounds robotic. They're free:"
            )}
          </p>
          <ol>
            <li>
              {t(
                'Ajustes del Sistema → Accesibilidad → Contenido leído.',
                'System Settings → Accessibility → Spoken Content.'
              )}
            </li>
            <li>
              {t(
                'En “Voz del sistema”, abre la lista y elige “Administrar voces…”.',
                'In “System voice”, open the list and choose “Manage Voices…”.'
              )}
            </li>
            <li>
              {t('Busca', 'Look for')} <em>{t('Español', 'Spanish')}</em>{' '}
              {t(
                'y descarga una “(Mejorada)” o “(Premium)” (por ejemplo Paulina o Mónica).',
                'and download an “(Enhanced)” or “(Premium)” one (for example Paulina or Mónica).'
              )}
            </li>
            <li>
              {t(
                'Vuelve aquí y toca “Actualizar voces”.',
                'Come back here and tap “Refresh voices”.'
              )}
            </li>
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
              {t('Abrir Accesibilidad', 'Open Accessibility')}
            </button>
            <button className="button-ghost" disabled={refreshing} onClick={reload}>
              {refreshing ? t('Buscando…', 'Looking…') : t('Actualizar voces', 'Refresh voices')}
            </button>
          </div>
        </div>
      )}

      <label className="settings-field">
        <span>
          {t('Velocidad', 'Speed')}: {voice.rate.toFixed(1)}×
        </span>
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
          {t('Tono', 'Pitch')}:{' '}
          {voice.pitch === 1
            ? t('normal', 'normal')
            : voice.pitch < 1
              ? t('más grave', 'lower')
              : t('más agudo', 'higher')}
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
          ▶ {t('Probar', 'Test')}
        </button>
        <button className="button-ghost" onClick={stopSpeaking}>
          ⏹ {t('Parar', 'Stop')}
        </button>
        {IS_MAC && voices && hasGoodVoice(voices, 'es') && (
          <button className="button-ghost" disabled={refreshing} onClick={reload}>
            {refreshing ? t('Buscando…', 'Looking…') : t('Actualizar voces', 'Refresh voices')}
          </button>
        )}
      </div>

      {IS_MAC && (
        <div className="settings-subsection">
          <h4>🎤 {t('Hablarle a Dip', 'Talking to Dip')}</h4>
          <p className="settings-hint">
            {t(
              'Usa el dictado de la Mac: toca 🎤 junto al chat (o en Brain Dump), o pulsa dos veces la tecla',
              "It uses the Mac's dictation: tap 🎤 next to the chat (or in Brain Dump), or press the"
            )}{' '}
            <kbd>Fn</kbd>{' '}
            {t(
              '(🌐) en cualquier campo de texto. Habla y vuelve a tocarla para terminar. Lo convierte en texto macOS; Nuggit no graba nada.',
              "(🌐) key twice in any text field. Talk, then tap it again to finish. macOS turns it into text; Nuggit doesn't record anything."
            )}
          </p>
          <p className="settings-hint">
            {t(
              'Si no pasa nada, actívalo en Ajustes del Sistema → Teclado → Dictado.',
              'If nothing happens, turn it on in System Settings → Keyboard → Dictation.'
            )}
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
              {t('Abrir ajustes de Dictado', 'Open Dictation settings')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function VoiceRow({
  label,
  detail,
  checked,
  onChoose,
  onPlay
}: {
  label: string
  detail?: string
  checked: boolean
  onChoose(): void
  onPlay(): void
}): React.JSX.Element {
  return (
    <div className={`voice-row${checked ? ' is-checked' : ''}`}>
      <label>
        <input type="radio" name="dip-voice" checked={checked} onChange={onChoose} />
        <span>
          {label}
          {detail && <small> · {detail}</small>}
        </span>
      </label>
      <button
        className="icon-button"
        title={t('Escuchar', 'Listen')}
        aria-label={t(`Escuchar ${label}`, `Listen to ${label}`)}
        onClick={onPlay}
      >
        ▶
      </button>
    </div>
  )
}
