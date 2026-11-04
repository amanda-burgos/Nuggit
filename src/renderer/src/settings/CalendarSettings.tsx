import { useEffect, useState } from 'react'
import type { CalendarStatus } from '../../../shared/types'
import type { SectionProps } from './shared'
import { locale, t } from '../../../shared/i18n'

const log = (err: unknown): void => console.error('[calendar settings]', err)

function since(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
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
      setProblem(
        result?.error ?? t('No pude hablar con Calendario.', "I couldn't talk to Calendar.")
      )
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
      <h3>📅 {t('Calendario', 'Calendar')}</h3>
      <p className="settings-hint">
        {t(
          'Tus tareas con fecha y tus dailies ya están en la pestaña Calendario. Aquí decides si también aparecen en el calendario de tu Mac (o en Google). Todo es opcional.',
          'Your dated tasks and your dailies are already in the Calendar tab. Here you decide if they also show up in your Mac’s calendar (or in Google). It’s all optional.'
        )}
      </p>

      <div className="settings-subsection">
        <h4>🍎 {t('Calendario de la Mac, en dos vías', 'Mac Calendar, two-way')}</h4>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={calendar.apple}
            onChange={(e) => update({ calendar: { apple: e.target.checked } })}
          />
          <span>
            {t('Conectar con Calendario', 'Connect to Calendar')}
            <small>
              {t(
                'La primera vez macOS te pregunta si Nuggit puede usar Calendario. Nuggit solo escribe en su propio calendario “Nuggit”; los tuyos solo los lee.',
                'The first time, macOS asks if Nuggit can use Calendar. Nuggit only writes to its own “Nuggit” calendar; yours it only reads.'
              )}
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
                {t(
                  'Guardar mis tareas y dailies en un calendario “Nuggit”',
                  'Save my tasks and dailies in a “Nuggit” calendar'
                )}
                <small>
                  {t(
                    'Si mueves una tarea a otro día en Calendario, en Nuggit también se mueve.',
                    'If you move a task to another day in Calendar, it moves in Nuggit too.'
                  )}
                </small>
              </span>
            </label>

            <div className="settings-field">
              <span>{t('Mostrar en Nuggit los eventos de:', 'Show events in Nuggit from:')}</span>
              {macCalendars === null ? (
                <small className="settings-hint">
                  {busy ? t('Buscando calendarios…', 'Looking for calendars…') : ''}
                </small>
              ) : macCalendars.length === 0 ? (
                <small className="settings-hint">
                  {t('No encontré calendarios.', "I didn't find any calendars.")}
                </small>
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
                <legend>{t('Sincronizar', 'Sync')}</legend>
                <label>
                  <input
                    type="radio"
                    name="calendar-sync"
                    checked={calendar.autoSync}
                    onChange={() => update({ calendar: { autoSync: true } })}
                  />
                  {t(
                    'Automático: cada vez que cambias algo y cada 10 minutos',
                    'Automatic: every time you change something and every 10 minutes'
                  )}
                </label>
                <label>
                  <input
                    type="radio"
                    name="calendar-sync"
                    checked={!calendar.autoSync}
                    onChange={() => update({ calendar: { autoSync: false } })}
                  />
                  {t(
                    'Manual: solo cuando toques “Sincronizar ahora”',
                    'Manual: only when you tap “Sync now”'
                  )}
                </label>
              </fieldset>
            )}

            <div className="settings-row is-centered">
              <div className={`ai-state${status?.apple === 'ok' ? ' is-on' : ''}`}>
                <span className="ai-dot" aria-hidden />
                {status?.apple === 'syncing'
                  ? t('Sincronizando…', 'Syncing…')
                  : status?.apple === 'ok'
                    ? status.lastSync
                      ? `${calendar.autoSync ? t('Al día', 'Up to date') : t('Última vez', 'Last time')} (${since(status.lastSync)})`
                      : calendar.autoSync
                        ? t('Conectado', 'Connected')
                        : t('Conectado · sin sincronizar todavía', 'Connected · not synced yet')
                    : (status?.error ?? t('Conectando…', 'Connecting…'))}
              </div>
              <button
                className="button-ghost"
                disabled={status?.apple === 'syncing'}
                onClick={() => {
                  loadCalendars()
                  window.api.calendar.syncNow().catch(log)
                }}
              >
                {t('Sincronizar ahora', 'Sync now')}
              </button>
            </div>
            {problem && <p className="settings-status is-error">{problem}</p>}
            <small className="settings-hint">
              {t(
                'Los eventos que se repiten aparecen en Nuggit el día en que empezó la serie.',
                'Repeating events show up in Nuggit on the day the series started.'
              )}
            </small>
          </>
        )}
      </div>

      <div className="settings-subsection">
        <h4>📡 {t('Suscripción (solo lectura)', 'Subscription (read-only)')}</h4>
        <p className="settings-hint">
          {t(
            'La forma más fácil: tu Mac se suscribe a Nuggit y ve tus tareas y dailies, sin permisos. Se actualiza sola mientras Nuggit está abierto.',
            'The easiest way: your Mac subscribes to Nuggit and sees your tasks and dailies, no permissions needed. It updates on its own while Nuggit is open.'
          )}
        </p>
        {calendar.feed && status?.feedUrl ? (
          <div className="settings-row is-centered">
            <code className="settings-path">{status.feedUrl}</code>
            <button className="button-ghost" onClick={() => update({ calendar: { feed: false } })}>
              {t('Dejar de compartir', 'Stop sharing')}
            </button>
          </div>
        ) : (
          <div className="settings-row">
            <button
              className="button-ghost"
              onClick={() => window.api.calendar.subscribe().catch(log)}
            >
              {t('Suscribirme en Calendario', 'Subscribe in Calendar')}
            </button>
          </div>
        )}
        {doubled && (
          <p className="settings-status is-error">
            {t(
              'Con las dos cosas prendidas vas a ver tus tareas dos veces en Calendario. Mejor usa una.',
              "With both turned on you'll see your tasks twice in Calendar. Better to use just one."
            )}
          </p>
        )}
      </div>

      <div className="settings-subsection">
        <h4>📤 {t('Exportar (.ics)', 'Export (.ics)')}</h4>
        <p className="settings-hint">
          {t(
            'Un archivo con tus tareas y dailies para cualquier calendario. En Google Calendar: Configuración → Importar y exportar → Importar. Es una copia: no se actualiza sola.',
            "A file with your tasks and dailies for any calendar. In Google Calendar: Settings → Import & export → Import. It's a copy: it doesn't update on its own."
          )}
        </p>
        <div className="settings-row is-centered">
          <button className="button-ghost" onClick={exportIcs}>
            {t('Exportar .ics', 'Export .ics')}
          </button>
          {exported && (
            <small className="settings-hint">
              {t('Guardado en', 'Saved to')} {exported}
            </small>
          )}
        </div>
      </div>

      <div className="settings-subsection">
        <h4>🔜 {t('Google Calendar en dos vías', 'Google Calendar, two-way')}</h4>
        <p className="settings-hint">
          {t(
            'Pronto. Necesita entrar con tu cuenta de Google. Mientras tanto, usa Exportar.',
            'Coming soon. It needs you to sign in with your Google account. In the meantime, use Export.'
          )}
        </p>
      </div>
    </section>
  )
}
