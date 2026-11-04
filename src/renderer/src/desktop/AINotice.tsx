import { t } from '../../../shared/i18n'

// Shown instead of a widget or panel that needs AI while no AI is available.
export function AINotice(): React.JSX.Element {
  return (
    <div className="ai-notice">
      <p className="ai-notice-title">
        {t(
          'Dip no tiene una IA disponible ahora 💤',
          "Dip doesn't have an AI available right now 💤"
        )}
      </p>
      <p>
        {t(
          'Abre Ollama en tu Mac, o conecta Gemini o tu servidor en Ajustes. Todo lo demás en Nuggit funciona igual sin IA.',
          'Open Ollama on your Mac, or connect Gemini or your server in Settings. Everything else in Nuggit works the same without AI.'
        )}
      </p>
      <button className="button-primary" onClick={() => window.api.app.openSettings()}>
        {t('Ir a Ajustes', 'Go to Settings')}
      </button>
    </div>
  )
}
