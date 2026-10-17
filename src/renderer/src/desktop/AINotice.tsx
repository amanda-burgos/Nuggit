// Shown instead of a widget or panel that needs AI while no AI is available.
export function AINotice(): React.JSX.Element {
  return (
    <div className="ai-notice">
      <p className="ai-notice-title">Dip no tiene una IA disponible ahora 💤</p>
      <p>
        Abre Ollama en tu Mac, o conecta Gemini o tu servidor en Ajustes. Todo lo demás en Nuggit
        funciona igual sin IA.
      </p>
      <button className="button-primary" onClick={() => window.api.app.openSettings()}>
        Ir a Ajustes
      </button>
    </div>
  )
}
