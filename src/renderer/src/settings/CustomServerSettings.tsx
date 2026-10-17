import { useState } from 'react'
import type { AIStatus, CustomServerSettings as Server } from '../../../shared/types'
import type { SectionProps, Status } from './shared'

const MAX_SERVERS = 5

function validUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// SPEC 8: the user's own server that speaks the OpenAI API, with backups. Everything typed
// here is saved in settings.json on this computer (the key, encrypted, apart).
export function CustomServerSettings({
  settings,
  update,
  aiStatus,
  setStatus
}: SectionProps & {
  aiStatus: AIStatus | null
  setStatus(status: Status): void
}): React.JSX.Element {
  const saved = settings.ai.custom
  const [name, setName] = useState(saved?.name ?? '')
  const [model, setModel] = useState(saved?.model ?? '')
  const [servers, setServers] = useState<string[]>(saved?.servers.length ? saved.servers : [''])

  const filled = servers.map((s) => s.trim()).filter(Boolean)
  const badUrl = filled.find((s) => !validUrl(s))
  const draft: Server = { name: name.trim() || 'Mi servidor', model: model.trim(), servers: filled }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved ?? null)
  const canSave = Boolean(draft.model) && filled.length > 0 && !badUrl && changed

  const save = (): void => {
    update({ ai: { custom: draft } })
    setStatus({ kind: 'info', text: 'Servidor guardado. Revisando si responde…' })
  }

  const remove = (): void => {
    if (!window.confirm('¿Quitar tu servidor propio de Nuggit?')) return
    update({ ai: { custom: null } })
    setName('')
    setModel('')
    setServers([''])
    setStatus({ kind: 'info', text: 'Servidor quitado.' })
  }

  const setServer = (i: number, value: string): void =>
    setServers((list) => list.map((s, j) => (j === i ? value : s)))

  const move = (i: number, by: -1 | 1): void =>
    setServers((list) => {
      const next = [...list]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })

  return (
    <div className="settings-subsection">
      <h4>🖥️ Servidor propio (compatible con OpenAI)</h4>
      <p className="settings-hint">
        {!saved
          ? 'Un servidor tuyo que habla la API de OpenAI, por ejemplo uno en tu red con Tailscale.'
          : aiStatus?.custom
            ? 'Responde y está listo.'
            : 'No responde ahora. Si necesita Tailscale (o una VPN), revisa que esté prendido.'}
      </p>

      <form
        className="custom-server"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save()
        }}
      >
        <label className="settings-field">
          <span>Nombre</span>
          <input
            value={name}
            placeholder="Mi servidor"
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="settings-field">
          <span>Modelo</span>
          <input
            value={model}
            placeholder="El nombre exacto del modelo en el servidor"
            spellCheck={false}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>

        <fieldset className="settings-field custom-server-list">
          <legend>Servidores (base URL, termina en /v1)</legend>
          {servers.map((url, i) => (
            <div key={i} className="custom-server-row">
              <span className="custom-server-label">{i === 0 ? 'Principal' : `Respaldo ${i}`}</span>
              <input
                value={url}
                type="url"
                placeholder="http://…/v1"
                aria-label={i === 0 ? 'Servidor principal' : `Servidor de respaldo ${i}`}
                spellCheck={false}
                aria-invalid={Boolean(url.trim()) && !validUrl(url)}
                onChange={(e) => setServer(i, e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                title="Subir"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                title="Bajar"
                disabled={i === servers.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button"
                title="Quitar este servidor"
                disabled={servers.length === 1}
                onClick={() => setServers((list) => list.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          {servers.length < MAX_SERVERS && (
            <button
              type="button"
              className="button-ghost custom-server-add"
              onClick={() => setServers((list) => [...list, ''])}
            >
              + Agregar respaldo
            </button>
          )}
          <small>
            {badUrl
              ? `"${badUrl}" no parece una dirección (debe empezar con http:// o https://).`
              : 'Si el principal no responde o tarda mucho, Dip prueba el siguiente.'}
          </small>
        </fieldset>

        <div className="settings-row">
          <button type="submit" className="button-primary" disabled={!canSave}>
            Guardar servidor
          </button>
          {saved && (
            <button type="button" className="button-ghost" onClick={remove}>
              Quitar
            </button>
          )}
        </div>
      </form>

      <ServerKey hasKey={aiStatus?.customKey ?? false} setStatus={setStatus} />
    </div>
  )
}

// Optional: most home servers don't need one.
function ServerKey({
  hasKey,
  setStatus
}: {
  hasKey: boolean
  setStatus(status: Status): void
}): React.JSX.Element {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  if (hasKey) {
    return (
      <div className="settings-row is-centered">
        <span className="settings-hint">
          API key del servidor guardada (cifrada en este equipo).
        </span>
        <button
          className="button-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await window.api.ai.removeServerKey().catch(() => undefined)
            setBusy(false)
            setStatus({ kind: 'info', text: 'Key del servidor quitada.' })
          }}
        >
          Quitar key
        </button>
      </div>
    )
  }

  return (
    <form
      className="settings-row"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const result = await window.api.ai.saveServerKey(input)
        setBusy(false)
        if (!result.ok) return setStatus({ kind: 'error', text: result.error })
        setInput('')
        setStatus({ kind: 'ok', text: 'Key del servidor guardada 🔑' })
      }}
    >
      <input
        type="password"
        value={input}
        placeholder="API key (opcional, casi nunca hace falta)"
        aria-label="API key del servidor"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit" className="button-ghost" disabled={!input.trim() || busy}>
        Guardar key
      </button>
    </form>
  )
}
