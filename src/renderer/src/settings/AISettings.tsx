import { useState } from 'react'
import type { AIBackend, AIModelOption, AIStatus, Settings } from '../../../shared/types'
import { useAIStatus } from '../store/useAIStatus'
import { AgentsInfo } from './AgentsInfo'
import { CustomServerSettings } from './CustomServerSettings'
import { StatusMessage, type SectionProps, type Status } from './shared'
import { t } from '../../../shared/i18n'

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const SUGGESTED_OLLAMA_MODEL = 'llama3.2'
const KEY_URL = 'https://aistudio.google.com/apikey'
const OLLAMA_URL = 'https://ollama.com/download'

type Choice = 'auto' | AIBackend
type Busy = 'save' | 'test' | 'remove' | 'switch' | null

const DEFAULT_ORDER: AIBackend[] = ['gemini', 'ollama', 'custom']

function backendName(backend: AIBackend, settings: Settings): string {
  if (backend === 'custom') return settings.ai.custom?.name || t('tu servidor', 'your server')
  return backend === 'gemini' ? 'Gemini' : 'Ollama'
}

const BACKEND_ICONS: Record<AIBackend, string> = { gemini: '☁️', ollama: '🏠', custom: '🖥️' }

const choices = (): Array<{ value: Choice; title: string; text: string }> => [
  {
    value: 'auto',
    title: t('✨ Automático', '✨ Automatic'),
    text: t(
      'Usa la primera disponible, en el orden que elijas. Si una falla, prueba la siguiente.',
      'Uses the first one available, in the order you choose. If one fails, it tries the next.'
    )
  },
  {
    value: 'ollama',
    title: '🏠 Ollama',
    text: t(
      'En tu Mac. Gratis, sin cuenta y sin key. Lo que escribes no sale de tu computadora.',
      'On your Mac. Free, no account and no key. What you write never leaves your computer.'
    )
  },
  {
    value: 'gemini',
    title: '☁️ Gemini',
    text: t(
      'En internet, de Google. Necesita una key (la cuenta debe ser de alguien de 18 o más).',
      'Online, from Google. Needs a key (the account must belong to someone 18 or older).'
    )
  },
  {
    value: 'custom',
    title: t('🖥️ Servidor propio', '🖥️ Your own server'),
    text: t(
      'Un servidor tuyo compatible con OpenAI, con servidores de respaldo.',
      'Your own OpenAI-compatible server, with backup servers.'
    )
  }
]

function describeStatus(status: AIStatus | null, choice: Choice, settings: Settings): string {
  if (!status) return t('Revisando…', 'Checking…')
  if (status.active) {
    const name = backendName(status.active, settings)
    return t(`Ahora Dip usa ${name}`, `Dip is using ${name} now`)
  }
  if (choice === 'gemini')
    return t('Falta guardar una key de Gemini', 'You still need to save a Gemini key')
  if (choice === 'ollama') {
    return t('Ollama no está abierto (o no tiene modelos)', "Ollama isn't open (or has no models)")
  }
  if (choice === 'custom') {
    return settings.ai.custom
      ? t(
          'Tu servidor no responde. ¿Está Tailscale prendido?',
          "Your server isn't answering. Is Tailscale on?"
        )
      : t('Falta agregar tu servidor (abajo)', 'You still need to add your server (below)')
  }
  return t(
    'Ninguna IA disponible: abre Ollama, guarda una key de Gemini o agrega tu servidor',
    'No AI available: open Ollama, save a Gemini key or add your server'
  )
}

// Connecting Dip to an AI: automatic, Ollama (local) or Gemini (online).
export function AISettings({ settings, update }: SectionProps): React.JSX.Element {
  const aiStatus = useAIStatus()
  const saved = settings.ai.provider
  const [choice, setChoice] = useState<Choice>(
    saved === 'gemini' || saved === 'ollama' || saved === 'custom' ? saved : 'auto'
  )
  const [busy, setBusy] = useState<Busy>(null)
  const [status, setStatus] = useState<Status>(null)
  const [models, setModels] = useState<Partial<Record<AIBackend, AIModelOption[]>>>({})

  const test = async (): Promise<void> => {
    setBusy('test')
    setStatus({ kind: 'info', text: t('Probando la conexión…', 'Testing the connection…') })
    const result = await window.api.ai.test()
    setBusy(null)
    if (result.ok) {
      setModels((m) => ({ ...m, [result.backend]: result.models }))
      setStatus({
        kind: 'ok',
        text: t(
          `¡Conectado! Dip está usando ${backendName(result.backend, settings)} (${result.model}) ✨`,
          `Connected! Dip is using ${backendName(result.backend, settings)} (${result.model}) ✨`
        )
      })
    } else {
      setStatus({ kind: 'error', text: result.error })
    }
  }

  const choose = async (next: Choice): Promise<void> => {
    if (next === choice) return
    setChoice(next)
    setStatus(null)
    setBusy('switch')
    await window.api.ai.setProvider(next).catch((err) => console.error('Could not switch', err))
    setBusy(null)
  }

  const showGemini = choice === 'auto' || choice === 'gemini'
  const showOllama = choice === 'auto' || choice === 'ollama'
  const showCustom = choice === 'auto' || choice === 'custom'

  return (
    <section className="settings-section">
      <h3>🤖 {t('IA de Dip', "Dip's AI")}</h3>
      <p className="settings-hint">
        {t('Sin IA, Nuggit funciona igual.', 'Nuggit works just the same without AI.')}
      </p>

      <div className="provider-picker" role="radiogroup" aria-label={t('IA de Dip', "Dip's AI")}>
        {choices().map((option) => (
          <label
            key={option.value}
            className={`provider-option${choice === option.value ? ' is-checked' : ''}`}
          >
            <input
              type="radio"
              name="ai-provider"
              checked={choice === option.value}
              disabled={busy !== null}
              onChange={() => choose(option.value)}
            />
            <span>
              <strong>{option.title}</strong>
              <small>{option.text}</small>
            </span>
          </label>
        ))}
      </div>

      <div className="settings-row is-centered">
        <div className={`ai-state${aiStatus?.active ? ' is-on' : ''}`}>
          <span className="ai-dot" aria-hidden />
          {describeStatus(aiStatus, choice, settings)}
        </div>
        {aiStatus?.active && (
          <button className="button-ghost" disabled={busy !== null} onClick={test}>
            {busy === 'test' ? t('Probando…', 'Testing…') : t('Probar conexión', 'Test connection')}
          </button>
        )}
      </div>

      <StatusMessage status={status} />

      {choice === 'auto' && (
        <ProviderOrder
          order={settings.ai.order?.length ? settings.ai.order : DEFAULT_ORDER}
          settings={settings}
          aiStatus={aiStatus}
          onChange={(order) => update({ ai: { order } })}
        />
      )}

      {showCustom && (
        <CustomServerSettings
          // Starts over from what is saved whenever that changes (e.g. from another window).
          key={JSON.stringify(settings.ai.custom ?? null)}
          settings={settings}
          update={update}
          aiStatus={aiStatus}
          setStatus={setStatus}
        />
      )}

      {showOllama && (
        <div className="settings-subsection">
          <h4>🏠 Ollama</h4>
          <p className="settings-hint">
            {aiStatus?.ollama
              ? t('Abierto y listo.', 'Open and ready.')
              : t('No está abierto, o no tiene modelos.', "It isn't open, or has no models.")}
          </p>
          <ModelField
            id="ollama-models"
            value={settings.ai.ollamaModel}
            placeholder={t('El primero que tengas instalado', 'The first one you have installed')}
            emptyHint={t(
              'Déjalo vacío para usar el primer modelo que tengas.',
              'Leave it empty to use the first model you have.'
            )}
            models={models.ollama ?? []}
            onSave={(ollamaModel) => update({ ai: { ollamaModel } })}
          />
          <OllamaGuide />
        </div>
      )}

      {showGemini && (
        <div className="settings-subsection">
          <h4>☁️ Gemini</h4>
          <GeminiKey
            hasKey={aiStatus?.gemini ?? false}
            busy={busy}
            setBusy={setBusy}
            setStatus={setStatus}
            test={test}
          />
          <ModelField
            id="gemini-models"
            value={settings.ai.model}
            placeholder={`${DEFAULT_GEMINI_MODEL} ${t('(recomendado)', '(recommended)')}`}
            emptyHint={t(
              'Déjalo vacío para usar el recomendado.',
              'Leave it empty to use the recommended one.'
            )}
            models={models.gemini ?? []}
            onSave={(model) => update({ ai: { model } })}
          />
          <GeminiGuide />
        </div>
      )}

      <AgentsInfo settings={settings} aiStatus={aiStatus} />

      <label className="settings-check">
        <input
          type="checkbox"
          checked={settings.ai.shareTasksWithAI}
          onChange={(e) => update({ ai: { shareTasksWithAI: e.target.checked } })}
        />
        <span>
          {t('Compartir tareas con Dip', 'Share tasks with Dip')}
          <small>
            {t(
              'Dip ve tus tareas pendientes (título, fecha, prioridad y tiempo) para ayudarte a decidir. Nunca las cambia.',
              'Dip sees your pending tasks (title, date, priority and time) to help you decide. It never changes them.'
            )}
          </small>
        </span>
      </label>
    </section>
  )
}

// "Automático" tries them in this order.
function ProviderOrder({
  order,
  settings,
  aiStatus,
  onChange
}: {
  order: AIBackend[]
  settings: Settings
  aiStatus: AIStatus | null
  onChange(order: AIBackend[]): void
}): React.JSX.Element {
  const move = (i: number, by: -1 | 1): void => {
    const next = [...order]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }

  return (
    <div className="settings-subsection">
      <h4>{t('Orden en automático', 'Order in automatic')}</h4>
      <ol className="provider-order">
        {order.map((backend, i) => (
          <li key={backend}>
            <span className={`ai-dot${aiStatus?.[backend] ? ' is-on' : ''}`} aria-hidden />
            <span className="provider-order-name">
              {BACKEND_ICONS[backend]} {backendName(backend, settings)}
              {!aiStatus?.[backend] && (
                <small>{t(' (no disponible ahora)', ' (not available now)')}</small>
              )}
            </span>
            <button
              className="icon-button"
              title={t('Subir', 'Move up')}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              className="icon-button"
              title={t('Bajar', 'Move down')}
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <small>
        {t(
          'Dip usa la primera que esté disponible. Si falla, prueba la siguiente.',
          'Dip uses the first one available. If it fails, it tries the next.'
        )}
      </small>
    </div>
  )
}

function GeminiKey({
  hasKey,
  busy,
  setBusy,
  setStatus,
  test
}: {
  hasKey: boolean
  busy: Busy
  setBusy(busy: Busy): void
  setStatus(status: Status): void
  test(): Promise<void>
}): React.JSX.Element {
  const [keyInput, setKeyInput] = useState('')
  const [replacing, setReplacing] = useState(false)

  const saveKey = async (): Promise<void> => {
    setBusy('save')
    setStatus(null)
    const result = await window.api.ai.saveKey(keyInput)
    setBusy(null)
    if (!result.ok) return setStatus({ kind: 'error', text: result.error })
    setKeyInput('')
    setReplacing(false)
    await test()
  }

  const removeKey = async (): Promise<void> => {
    if (!window.confirm(t('¿Quitar la key de Gemini?', 'Remove the Gemini key?'))) return
    setBusy('remove')
    await window.api.ai.removeKey().catch((err) => console.error('Could not remove key', err))
    setBusy(null)
    setStatus({ kind: 'info', text: t('Key quitada.', 'Key removed.') })
  }

  if (hasKey && !replacing) {
    return (
      <div className="settings-row is-centered">
        <span className="settings-hint">
          {t('Key guardada (cifrada en este equipo).', 'Key saved (encrypted on this computer).')}
        </span>
        <button
          className="button-ghost"
          disabled={busy !== null}
          onClick={() => setReplacing(true)}
        >
          {t('Cambiar', 'Change')}
        </button>
        <button className="button-ghost" disabled={busy !== null} onClick={removeKey}>
          {t('Quitar', 'Remove')}
        </button>
      </div>
    )
  }

  return (
    <form
      className="settings-row"
      onSubmit={(e) => {
        e.preventDefault()
        saveKey()
      }}
    >
      <input
        type="password"
        value={keyInput}
        placeholder={t('Pega aquí tu API key de Gemini', 'Paste your Gemini API key here')}
        aria-label={t('API key de Gemini', 'Gemini API key')}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setKeyInput(e.target.value)}
      />
      <button type="submit" className="button-primary" disabled={!keyInput.trim() || busy !== null}>
        {busy === 'save' ? t('Guardando…', 'Saving…') : t('Guardar', 'Save')}
      </button>
      {replacing && (
        <button type="button" className="button-ghost" onClick={() => setReplacing(false)}>
          {t('Cancelar', 'Cancel')}
        </button>
      )}
    </form>
  )
}

// Free text with suggestions: the list fills in after a successful "Probar conexión".
function ModelField({
  id,
  value,
  placeholder,
  emptyHint,
  models,
  onSave
}: {
  id: string
  value: string | undefined
  placeholder: string
  emptyHint: string
  models: AIModelOption[]
  onSave(model: string | null): void
}): React.JSX.Element {
  const [input, setInput] = useState(value ?? '')

  const save = (): void => {
    const next = input.trim()
    if (next !== (value ?? '')) onSave(next || null)
  }

  return (
    <label className="settings-field">
      <span>{t('Modelo', 'Model')}</span>
      <input
        list={id}
        value={input}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
        }}
      />
      <datalist id={id}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </datalist>
      <small>
        {emptyHint}
        {models.length > 0 &&
          t(
            ' Haz clic en el campo para ver los modelos disponibles.',
            ' Click the field to see the available models.'
          )}
      </small>
    </label>
  )
}

function GeminiGuide(): React.JSX.Element {
  return (
    <details className="settings-guide">
      <summary>{t('¿Cómo saco una key gratis?', 'How do I get a free key?')}</summary>
      <ol>
        <li>
          {t('Una persona de 18 años o más entra a', 'Someone 18 or older goes to')}{' '}
          <a href={KEY_URL} target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{' '}
          {t('con su cuenta de Google.', 'with their Google account.')}
        </li>
        <li>
          {t('Hace clic en', 'Clicks')} <strong>Create API key</strong>
          {t(' (Crear clave de API).', '.')}
        </li>
        <li>
          {t(
            'Copia la key, pégala arriba y dale a Guardar.',
            'Copy the key, paste it above and hit Save.'
          )}
        </li>
      </ol>
      <p>
        {t(
          'Es gratis, con un límite de preguntas por día. En el plan gratis, Google puede usar lo que le escribes para mejorar sus modelos, así que no le cuentes cosas muy privadas.',
          "It's free, with a limit on questions per day. On the free plan, Google can use what you write to improve its models, so don't tell it anything very private."
        )}
      </p>
    </details>
  )
}

function OllamaGuide(): React.JSX.Element {
  return (
    <details className="settings-guide">
      <summary>{t('¿Cómo instalo Ollama?', 'How do I install Ollama?')}</summary>
      <ol>
        <li>
          {t(
            'Pide permiso a un adulto antes de instalar un programa nuevo.',
            'Ask a grown-up for permission before installing a new program.'
          )}
        </li>
        <li>
          {t('Descarga Ollama desde', 'Download Ollama from')}{' '}
          <a href={OLLAMA_URL} target="_blank" rel="noreferrer">
            ollama.com/download
          </a>
          {t(', instálalo y ábrelo.', ', install it and open it.')}
        </li>
        <li>
          {t('Abre la app Terminal y escribe:', 'Open the Terminal app and type:')}{' '}
          <code>ollama pull {SUGGESTED_OLLAMA_MODEL}</code>{' '}
          {t('(baja un modelo de unos 2 GB).', '(downloads a model of about 2 GB).')}
        </li>
        <li>
          {t(
            'Listo: aquí arriba debe decir que está abierto.',
            'Done: up here it should say it’s open.'
          )}
        </li>
      </ol>
      <p>
        {t(
          'Ollama tiene que estar abierto para que Dip lo use. La primera respuesta puede tardar un poco mientras el modelo se carga.',
          'Ollama has to be open for Dip to use it. The first answer can take a little while as the model loads.'
        )}
      </p>
    </details>
  )
}
