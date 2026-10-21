import { useEffect, useState } from 'react'
import type { CalendarStatus } from '../../../shared/types'
import type { SectionProps } from './shared'

const log = (err: unknown): void => console.error('[calendar settings]', err)

function since(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

// SPEC 9.14: the ways Nuggit's calendar connects to others. All optional.
export function CalendarSettings({ settings, update }: SectionProps): React.JSX.Element {
  const { calendar } = settings
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [macCalendars, setMacCalendars] = useState<string[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exported, setExported] = useState<string | null>(null)

  useEffect(() => {
    window.api.calendar.status().then(setStatus).catch(log)
    return window.api.calendar.onStatus(setStatus)
  }, [])

  const applyList = (
    result: { ok: true; calendars: string[] } | { ok: false; error: string } | null
  ): void => {
    setBusy(false)
    if (result?.ok) {
      setMacCalendars(result.calendars.filter((c) => c !== 'Nuggit'))
      setProblem(null)
    } else {
      setProblem(result?.error ?? 'No pude hablar con Calendario.')
    }
  }

  // Asks Calendar for its calendars (macOS asks for permission the first time).
  const loadCalendars = (): void => {
    setBusy(true)
    window.api.calendar
      .listAppleCalendars()
      .catch(() => null)
      .then(applyList)
  }

  // The list loads once the connection is on (and when this tab opens with it on).
  useEffect(() => {
    if (!calendar.apple) return
    window.api.calendar
      .listAppleCalendars()
      .catch(() => null)
      .then(applyList)
  }, [calendar.apple])

  const toggleShown = (name: string, on: boolean): void => {
    const next = on
      ? [...calendar.showCalendars, name]
      : calendar.showCalendars.filter((n) => n !== name)
    update({ calendar: { showCalendars: next } })
  }

  const exportIcs = async (): Promise<void> => {
    const result = await window.api.calendar.exportIcs().catch(() => null)
    setExported(result?.ok ? (result.path ?? null) : null)
  }

  const doubled = calendar.feed && calendar.apple && calendar.writeToApple

  return (
    <section className="settings-section">
      <h3>📅 Calendario</h3>
      <p className="settings-hint">
        Tus tareas con fecha y tus dailies ya están en la pestaña Calendario. Aquí decides si
        también aparecen en el calendario de tu Mac (o en Google). Todo es opcional.
      </p>

      <div className="settings-subsection">
        <h4>🍎 Calendario de la Mac, en dos vías</h4>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={calendar.apple}
            onChange={(e) => update({ calendar: { apple: e.target.checked } })}
          />
          <span>
            Conectar con Calendario
            <small>
              La primera vez macOS te pregunta si Nuggit puede usar Calendario. Nuggit solo escribe
              en su propio calendario “Nuggit”; los tuyos solo los lee.
            </small>
          </span>
        </label>

        {calendar.apple && (
          <>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={calendar.writeToApple}
                onChange={(e) => update({ calendar: { writeToApple: e.target.checked } })}
              />
              <span>
                Guardar mis tareas y dailies en un calendario “Nuggit”
                <small>
                  Si mueves una tarea a otro día en Calendario, en Nuggit también se mueve.
                </small>
              </span>
            </label>

            <div className="settings-field">
              <span>Mostrar en Nuggit los eventos de:</span>
              {macCalendars === null ? (
                <small className="settings-hint">{busy ? 'Buscando calendarios…' : ''}</small>
              ) : macCalendars.length === 0 ? (
                <small className="settings-hint">No encontré calendarios.</small>
              ) : (
                <div className="calendar-pick">
                  {macCalendars.map((name) => (
                    <label key={name} className="settings-check">
                      <input
                        type="checkbox"
                        checked={calendar.showCalendars.includes(name)}
                        onChange={(e) => toggleShown(name, e.target.checked)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {calendar.writeToApple && (
              <fieldset className="settings-choices">
                <legend>Sincronizar</legend>
                <label>
                  <input
                    type="radio"
                    name="calendar-sync"
                    checked={calendar.autoSync}
                    onChange={() => update({ calendar: { autoSync: true } })}
                  />
                  Automático: cada vez que cambias algo y cada 10 minutos
                </label>
                <label>
                  <input
                    type="radio"
                    name="calendar-sync"
                    checked={!calendar.autoSync}
                    onChange={() => update({ calendar: { autoSync: false } })}
                  />
                  Manual: solo cuando toques “Sincronizar ahora”
                </label>
              </fieldset>
            )}

            <div className="settings-row is-centered">
              <div className={`ai-state${status?.apple === 'ok' ? ' is-on' : ''}`}>
                <span className="ai-dot" aria-hidden />
                {status?.apple === 'syncing'
                  ? 'Sincronizando…'
                  : status?.apple === 'ok'
                    ? status.lastSync
                      ? `${calendar.autoSync ? 'Al día' : 'Última vez'} (${since(status.lastSync)})`
                      : calendar.autoSync
                        ? 'Conectado'
                        : 'Conectado · sin sincronizar todavía'
                    : (status?.error ?? 'Conectando…')}
              </div>
              <button
                className="button-ghost"
                disabled={status?.apple === 'syncing'}
                onClick={() => {
                  loadCalendars()
                  window.api.calendar.syncNow().catch(log)
                }}
              >
                Sincronizar ahora
              </button>
            </div>
            {problem && <p className="settings-status is-error">{problem}</p>}
            <small className="settings-hint">
              Los eventos que se repiten aparecen en Nuggit el día en que empezó la serie.
            </small>
          </>
        )}
      </div>

      <div className="settings-subsection">
        <h4>📡 Suscripción (solo lectura)</h4>
        <p className="settings-hint">
          La forma más fácil: tu Mac se suscribe a Nuggit y ve tus tareas y dailies, sin permisos.
          Se actualiza sola mientras Nuggit está abierto.
        </p>
        {calendar.feed && status?.feedUrl ? (
          <div className="settings-row is-centered">
            <code className="settings-path">{status.feedUrl}</code>
            <button className="button-ghost" onClick={() => update({ calendar: { feed: false } })}>
              Dejar de compartir
            </button>
          </div>
        ) : (
          <div className="settings-row">
            <button
              className="button-ghost"
              onClick={() => window.api.calendar.subscribe().catch(log)}
            >
              Suscribirme en Calendario
            </button>
          </div>
        )}
        {doubled && (
          <p className="settings-status is-error">
            Con las dos cosas prendidas vas a ver tus tareas dos veces en Calendario. Mejor usa una.
          </p>
        )}
      </div>

      <div className="settings-subsection">
        <h4>📤 Exportar (.ics)</h4>
        <p className="settings-hint">
          Un archivo con tus tareas y dailies para cualquier calendario. En Google Calendar:
          Configuración → Importar y exportar → Importar. Es una copia: no se actualiza sola.
        </p>
        <div className="settings-row is-centered">
          <button className="button-ghost" onClick={exportIcs}>
            Exportar .ics
          </button>
          {exported && <small className="settings-hint">Guardado en {exported}</small>}
        </div>
      </div>

      <div className="settings-subsection">
        <h4>🔜 Google Calendar en dos vías</h4>
        <p className="settings-hint">
          Pronto. Necesita entrar con tu cuenta de Google. Mientras tanto, usa Exportar.
        </p>
      </div>
    </section>
  )
}
