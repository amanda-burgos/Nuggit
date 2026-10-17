import { useEffect, useState } from 'react'
import type {
  AIAgentsInfo,
  AIBackend,
  AIConfigSource,
  AIStatus,
  Settings
} from '../../../shared/types'

// SPEC 8.1: which provider and model each agent uses, and where that comes from.

const SOURCES: Record<AIConfigSource, string> = {
  env: '.env',
  settings: 'Ajustes',
  default: 'por defecto'
}

const BACKENDS: Record<AIBackend, string> = {
  gemini: '☁️ Gemini',
  ollama: '🏠 Ollama',
  custom: '🖥️ Servidor propio'
}

export function AgentsInfo({
  settings,
  aiStatus
}: {
  settings: Settings
  aiStatus: AIStatus | null
}): React.JSX.Element | null {
  const [info, setInfo] = useState<AIAgentsInfo | null>(null)

  // Reloaded whenever the settings or what is available change.
  useEffect(() => {
    let cancelled = false
    window.api.ai
      .agents()
      .then((loaded) => {
        if (!cancelled) setInfo(loaded)
      })
      .catch((err) => console.error('Could not load the agents', err))
    return () => {
      cancelled = true
    }
  }, [settings, aiStatus])

  if (!info) return null
  const fromEnv = info.agents.some((a) => a.providerSource === 'env')

  return (
    <div className="settings-subsection">
      <h4>🧠 Agentes</h4>
      <p className="settings-hint">
        Cada parte de Dip es un agente con su propia IA. Si su respuesta no sirve, se le devuelve el
        error para que la corrija (hasta 2 veces).
      </p>
      {fromEnv && (
        <p className="settings-hint">
          Algunos agentes tienen la IA fijada en <code>.env</code>: eso manda sobre lo que elijas
          arriba.
        </p>
      )}
      <table className="agents-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>IA</th>
            <th>Modelo</th>
          </tr>
        </thead>
        <tbody>
          {info.agents.map((agent) => (
            <tr key={agent.name}>
              <td>
                <strong>{agent.label}</strong>
                <small>{agent.purpose}</small>
              </td>
              <td>
                {agent.backend ? BACKENDS[agent.backend] : 'Ninguna disponible'}
                <small>
                  {agent.provider === 'auto' ? 'automático' : 'fija'} ·{' '}
                  {SOURCES[agent.providerSource]}
                </small>
              </td>
              <td>
                <code>{agent.model || 'el primero instalado'}</code>
                <small>{SOURCES[agent.modelSource]}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="settings-hint">
        {info.envFile ? `Usando ${info.envFile}. ` : 'Sin archivo .env. '}
        Registro de intentos: <code>{info.logFile}</code>
      </small>
    </div>
  )
}
