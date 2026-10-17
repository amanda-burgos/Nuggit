import { useState } from 'react'
import type { AIBackend, AIModelOption, AIStatus, Settings } from '../../../shared/types'
import { useAIStatus } from '../store/useAIStatus'
import { AgentsInfo } from './AgentsInfo'
import { CustomServerSettings } from './CustomServerSettings'
import { StatusMessage, type SectionProps, type Status } from './shared'

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const SUGGESTED_OLLAMA_MODEL = 'llama3.2'
const KEY_URL = 'https://aistudio.google.com/apikey'
const OLLAMA_URL = 'https://ollama.com/download'

type Choice = 'auto' | AIBackend
type Busy = 'save' | 'test' | 'remove' | 'switch' | null

const DEFAULT_ORDER: AIBackend[] = ['gemini', 'ollama', 'custom']

function backendName(backend: AIBackend, settings: Settings): string {
  if (backend === 'custom') return settings.ai.custom?.name || 'tu servidor'
  return backend === 'gemini' ? 'Gemini' : 'Ollama'
}

const BACKEND_ICONS: Record<AIBackend, string> = { gemini: '☁️', ollama: '🏠', custom: '🖥️' }

const CHOICES: Array<{ value: Choice; title: string; text: string }> = [
  {
    value: 'auto',
    title: '✨ Automático',
    text: 'Usa la primera disponible, en el orden que elijas. Si una falla, prueba la siguiente.'
  },
  {
    value: 'ollama',
    title: '🏠 Ollama',
    text: 'En tu Mac. Gratis, sin cuenta y sin key. Lo que escribes no sale de tu computadora.'
  },
  {
    value: 'gemini',
    title: '☁️ Gemini',
    text: 'En internet, de Google. Necesita una key (la cuenta debe ser de alguien de 18 o más).'
  },
  {
    value: 'custom',
    title: '🖥️ Servidor propio',
    text: 'Un servidor tuyo compatible con OpenAI, con servidores de respaldo.'
  }
]

function describeStatus(status: AIStatus | null, choice: Choice, settings: Settings): string {
  if (!status) return 'Revisando…'
  if (status.active) return `Ahora Dip usa ${backendName(status.active, settings)}`
  if (choice === 'gemini') return 'Falta guardar una key de Gemini'
  if (choice === 'ollama') return 'Ollama no está abierto (o no tiene modelos)'
  if (choice === 'custom') {
    return settings.ai.custom
      ? 'Tu servidor no responde. ¿Está Tailscale prendido?'
      : 'Falta agregar tu servidor (abajo)'
  }
  return 'Ninguna IA disponible: abre Ollama, guarda una key de Gemini o agrega tu servidor'
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
    setStatus({ kind: 'info', text: 'Probando la conexión…' })
    const result = await window.api.ai.test()
    setBusy(null)
    if (result.ok) {
      setModels((m) => ({ ...m, [result.backend]: result.models }))
      setStatus({
        kind: 'ok',
        text: `¡Conectado! Dip está usando ${backendName(result.backend, settings)} (${result.model}) ✨`
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
      <h3>🤖 IA de Dip</h3>
      <p className="settings-hint">Sin IA, Nuggit funciona igual.</p>

      <div className="provider-picker" role="radiogroup" aria-label="IA de Dip">
        {CHOICES.map((option) => (
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
            {busy === 'test' ? 'Probando…' : 'Probar conexión'}
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
            {aiStatus?.ollama ? 'Abierto y listo.' : 'No está abierto, o no tiene modelos.'}
          </p>
          <ModelField
            id="ollama-models"
            value={settings.ai.ollamaModel}
            placeholder="El primero que tengas instalado"
            emptyHint="Déjalo vacío para usar el primer modelo que tengas."
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
            placeholder={`${DEFAULT_GEMINI_MODEL} (recomendado)`}
            emptyHint="Déjalo vacío para usar el recomendado."
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
          Compartir tareas con Dip
          <small>
            Dip ve tus tareas pendientes (título, fecha, prioridad y tiempo) para ayudarte a
            decidir. Nunca las cambia.
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
      <h4>Orden en automático</h4>
      <ol className="provider-order">
        {order.map((backend, i) => (
          <li key={backend}>
            <span className={`ai-dot${aiStatus?.[backend] ? ' is-on' : ''}`} aria-hidden />
            <span className="provider-order-name">
              {BACKEND_ICONS[backend]} {backendName(backend, settings)}
              {!aiStatus?.[backend] && <small> (no disponible ahora)</small>}
            </span>
            <button
              className="icon-button"
              title="Subir"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              className="icon-button"
              title="Bajar"
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <small>Dip usa la primera que esté disponible. Si falla, prueba la siguiente.</small>
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
    if (!window.confirm('¿Quitar la key de Gemini?')) return
    setBusy('remove')
    await window.api.ai.removeKey().catch((err) => console.error('Could not remove key', err))
    setBusy(null)
    setStatus({ kind: 'info', text: 'Key quitada.' })
  }

  if (hasKey && !replacing) {
    return (
      <div className="settings-row is-centered">
        <span className="settings-hint">Key guardada (cifrada en este equipo).</span>
        <button
          className="button-ghost"
          disabled={busy !== null}
          onClick={() => setReplacing(true)}
        >
          Cambiar
        </button>
        <button className="button-ghost" disabled={busy !== null} onClick={removeKey}>
          Quitar
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
        placeholder="Pega aquí tu API key de Gemini"
        aria-label="API key de Gemini"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setKeyInput(e.target.value)}
      />
      <button type="submit" className="button-primary" disabled={!keyInput.trim() || busy !== null}>
        {busy === 'save' ? 'Guardando…' : 'Guardar'}
      </button>
      {replacing && (
        <button type="button" className="button-ghost" onClick={() => setReplacing(false)}>
          Cancelar
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
      <span>Modelo</span>
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
        {models.length > 0 && ' Haz clic en el campo para ver los modelos disponibles.'}
      </small>
    </label>
  )
}

function GeminiGuide(): React.JSX.Element {
  return (
    <details className="settings-guide">
      <summary>¿Cómo saco una key gratis?</summary>
      <ol>
        <li>
          Una persona de 18 años o más entra a{' '}
          <a href={KEY_URL} target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{' '}
          con su cuenta de Google.
        </li>
        <li>
          Hace clic en <strong>Create API key</strong> (Crear clave de API).
        </li>
        <li>Copia la key, pégala arriba y dale a Guardar.</li>
      </ol>
      <p>
        Es gratis, con un límite de preguntas por día. En el plan gratis, Google puede usar lo que
        le escribes para mejorar sus modelos, así que no le cuentes cosas muy privadas.
      </p>
    </details>
  )
}

function OllamaGuide(): React.JSX.Element {
  return (
    <details className="settings-guide">
      <summary>¿Cómo instalo Ollama?</summary>
      <ol>
        <li>Pide permiso a un adulto antes de instalar un programa nuevo.</li>
        <li>
          Descarga Ollama desde{' '}
          <a href={OLLAMA_URL} target="_blank" rel="noreferrer">
            ollama.com/download
          </a>
          , instálalo y ábrelo.
        </li>
        <li>
          Abre la app Terminal y escribe: <code>ollama pull {SUGGESTED_OLLAMA_MODEL}</code> (baja un
          modelo de unos 2 GB).
        </li>
        <li>Listo: aquí arriba debe decir que está abierto.</li>
      </ol>
      <p>
        Ollama tiene que estar abierto para que Dip lo use. La primera respuesta puede tardar un
        poco mientras el modelo se carga.
      </p>
    </details>
  )
}
