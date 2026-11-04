import { useEffect, useState } from 'react'
import type {
  AIAgentsInfo,
  AIBackend,
  AIConfigSource,
  AIStatus,
  Settings
} from '../../../shared/types'
import { t } from '../../../shared/i18n'

// SPEC 8.1: which provider and model each agent uses, and where that comes from.

const sources = (): Record<AIConfigSource, string> => ({
  env: '.env',
  settings: t('Ajustes', 'Settings'),
  default: t('por defecto', 'default')
})

const backends = (): Record<AIBackend, string> => ({
  gemini: '☁️ Gemini',
  ollama: '🏠 Ollama',
  custom: t('🖥️ Servidor propio', '🖥️ Your own server')
})

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
  const SOURCES = sources()
  const BACKENDS = backends()

  return (
    <div className="settings-subsection">
      <h4>🧠 {t('Agentes', 'Agents')}</h4>
      <p className="settings-hint">
        {t(
          'Cada parte de Dip es un agente con su propia IA. Si su respuesta no sirve, se le devuelve el error para que la corrija (hasta 2 veces).',
          "Each part of Dip is an agent with its own AI. If its answer doesn't work, it gets the error back so it can fix it (up to 2 times)."
        )}
      </p>
      {fromEnv && (
        <p className="settings-hint">
          {t('Algunos agentes tienen la IA fijada en', 'Some agents have their AI set in')}{' '}
          <code>.env</code>
          {t(': eso manda sobre lo que elijas arriba.', ': that wins over what you pick above.')}
        </p>
      )}
      <table className="agents-table">
        <thead>
          <tr>
            <th>{t('Agente', 'Agent')}</th>
            <th>{t('IA', 'AI')}</th>
            <th>{t('Modelo', 'Model')}</th>
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
                {agent.backend
                  ? BACKENDS[agent.backend]
                  : t('Ninguna disponible', 'None available')}
                <small>
                  {agent.provider === 'auto' ? t('automático', 'automatic') : t('fija', 'fixed')} ·{' '}
                  {SOURCES[agent.providerSource]}
                </small>
              </td>
              <td>
                <code>{agent.model || t('el primero instalado', 'the first one installed')}</code>
                <small>{SOURCES[agent.modelSource]}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="settings-hint">
        {info.envFile
          ? t(`Usando ${info.envFile}. `, `Using ${info.envFile}. `)
          : t('Sin archivo .env. ', 'No .env file. ')}
        {t('Registro de intentos:', 'Attempt log:')} <code>{info.logFile}</code>
      </small>
    </div>
  )
}
