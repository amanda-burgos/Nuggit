import { useState } from 'react'
import type { AIStatus, CustomServerSettings as Server } from '../../../shared/types'
import type { SectionProps, Status } from './shared'
import { t } from '../../../shared/i18n'

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
  const draft: Server = {
    name: name.trim() || t('Mi servidor', 'My server'),
    model: model.trim(),
    servers: filled
  }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved ?? null)
  const canSave = Boolean(draft.model) && filled.length > 0 && !badUrl && changed

  // Saved straight through the main process, so "guardado" is only said once settings.json
  // really has it. Every window (this one too) then gets the new settings.
  const save = async (): Promise<void> => {
    setStatus({ kind: 'info', text: t('Guardando…', 'Saving…') })
    try {
      const result = await window.api.settings.update({ ai: { custom: draft } })
      if (result.ai.custom?.model === draft.model) {
        setStatus({
          kind: 'ok',
          text: t(
            'Servidor guardado ✓ Revisando si responde…',
            'Server saved ✓ Checking if it answers…'
          )
        })
      } else {
        setStatus({
          kind: 'error',
          text: t(
            'No se guardó. Revisa que las direcciones empiecen con http:// y que el modelo no tenga espacios. Si acabas de actualizar Nuggit, ciérrala y ábrela otra vez.',
            "It wasn't saved. Check that the addresses start with http:// and that the model has no spaces. If you just updated Nuggit, close it and open it again."
          )
        })
      }
    } catch (err) {
      console.error('Could not save the server', err)
      setStatus({
        kind: 'error',
        text: t(
          'No pude guardar el servidor. Intenta otra vez.',
          "I couldn't save the server. Try again."
        )
      })
    }
  }

  const remove = (): void => {
    if (
      !window.confirm(
        t('¿Quitar tu servidor propio de Nuggit?', 'Remove your own server from Nuggit?')
      )
    )
      return
    update({ ai: { custom: null } })
    setName('')
    setModel('')
    setServers([''])
    setStatus({ kind: 'info', text: t('Servidor quitado.', 'Server removed.') })
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
      <h4>
        🖥️ {t('Servidor propio (compatible con OpenAI)', 'Your own server (OpenAI-compatible)')}
      </h4>
      <p className="settings-hint">
        {!saved
          ? t(
              'Un servidor tuyo que habla la API de OpenAI, por ejemplo uno en tu red con Tailscale.',
              'A server of yours that speaks the OpenAI API, for example one on your network with Tailscale.'
            )
          : aiStatus?.custom
            ? t('Responde y está listo.', "It's answering and ready.")
            : t(
                'No responde ahora. Si necesita Tailscale (o una VPN), revisa que esté prendido.',
                "It isn't answering right now. If it needs Tailscale (or a VPN), check that it's on."
              )}
      </p>

      <form
        className="custom-server"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save()
        }}
      >
        <label className="settings-field">
          <span>{t('Nombre', 'Name')}</span>
          <input
            value={name}
            placeholder={t('Mi servidor', 'My server')}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="settings-field">
          <span>{t('Modelo', 'Model')}</span>
          <input
            value={model}
            placeholder={t(
              'El nombre exacto del modelo en el servidor',
              "The model's exact name on the server"
            )}
            spellCheck={false}
            onChange={(e) => setModel(e.target.value)}
          />
        </label>

        <fieldset className="settings-field custom-server-list">
          <legend>
            {t('Servidores (base URL, termina en /v1)', 'Servers (base URL, ends in /v1)')}
          </legend>
          {servers.map((url, i) => (
            <div key={i} className="custom-server-row">
              <span className="custom-server-label">
                {i === 0 ? t('Principal', 'Main') : t(`Respaldo ${i}`, `Backup ${i}`)}
              </span>
              <input
                value={url}
                type="url"
                placeholder="http://…/v1"
                aria-label={
                  i === 0
                    ? t('Servidor principal', 'Main server')
                    : t(`Servidor de respaldo ${i}`, `Backup server ${i}`)
                }
                spellCheck={false}
                aria-invalid={Boolean(url.trim()) && !validUrl(url)}
                onChange={(e) => setServer(i, e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                title={t('Subir', 'Move up')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                title={t('Bajar', 'Move down')}
                disabled={i === servers.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button"
                title={t('Quitar este servidor', 'Remove this server')}
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
              {t('+ Agregar respaldo', '+ Add backup')}
            </button>
          )}
          <small>
            {badUrl
              ? t(
                  `"${badUrl}" no parece una dirección (debe empezar con http:// o https://).`,
                  `"${badUrl}" doesn't look like an address (it must start with http:// or https://).`
                )
              : t(
                  'Si el principal no responde o tarda mucho, Dip prueba el siguiente.',
                  "If the main one doesn't answer or takes too long, Dip tries the next one."
                )}
          </small>
        </fieldset>

        <div className="settings-row">
          <button type="submit" className="button-primary" disabled={!canSave}>
            {t('Guardar servidor', 'Save server')}
          </button>
          {saved && (
            <button type="button" className="button-ghost" onClick={remove}>
              {t('Quitar', 'Remove')}
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
          {t(
            'API key del servidor guardada (cifrada en este equipo).',
            'Server API key saved (encrypted on this computer).'
          )}
        </span>
        <button
          className="button-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await window.api.ai.removeServerKey().catch(() => undefined)
            setBusy(false)
            setStatus({ kind: 'info', text: t('Key del servidor quitada.', 'Server key removed.') })
          }}
        >
          {t('Quitar key', 'Remove key')}
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
        setStatus({ kind: 'ok', text: t('Key del servidor guardada 🔑', 'Server key saved 🔑') })
      }}
    >
      <input
        type="password"
        value={input}
        placeholder={t(
          'API key (opcional, casi nunca hace falta)',
          'API key (optional, almost never needed)'
        )}
        aria-label={t('API key del servidor', 'Server API key')}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
      />
      <button type="submit" className="button-ghost" disabled={!input.trim() || busy}>
        {t('Guardar key', 'Save key')}
      </button>
    </form>
  )
}
