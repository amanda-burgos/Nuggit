import { useEffect, useState } from 'react'
import type { Reminder } from '../../../../shared/types'
import { describeReminderRepeat, describeWhen, nextRing } from '../../../../shared/reminders'
import { useNow, useReminders } from '../../store/useReminders'
import type { WidgetProps } from '../types'
import { ReminderEditor, type ReminderDraft } from './ReminderEditor'
import './reminders.css'
import { t } from '../../../../shared/i18n'

export type RemindersConfig = Record<string, never>

const RECENT_MS = 2 * 3_600_000 // "Posponer" shows for this long after it rang
const UNDO_MS = 6000

const fail =
  (what: string) =>
  (err: unknown): void =>
    console.error(`Could not ${what}`, err)

// Fase 12: reminders that ring as a system notice at their time, even with no window open.
// The widget shows the next ones and a quick add; the tab adds repeats, editing and the
// ones that already rang.
export function RemindersWidget({ size }: WidgetProps<RemindersConfig>): React.JSX.Element {
  const reminders = useReminders()
  const now = useNow()
  const [editing, setEditing] = useState<string | null>(null)
  const [undo, setUndo] = useState<Reminder[] | null>(null)
  const [openAtLogin, setOpenAtLogin] = useState<boolean | null>(null)
  const full = size === 'full'

  useEffect(() => {
    if (!full) return
    window.api.app
      .info()
      .then((info) => setOpenAtLogin(info.openAtLogin))
      .catch(fail('read the app info'))
  }, [full])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  if (!reminders) return <div className="reminders" />

  const create = (draft: ReminderDraft): void => {
    window.api.reminders.create(draft).catch(fail('create the reminder'))
  }
  const remove = (r: Reminder): void => {
    window.api.reminders
      .remove([r.id])
      .then((removed) => setUndo(removed.length ? removed : null))
      .catch(fail('remove the reminder'))
  }

  const upcoming = reminders
    .map((r) => ({ r, at: nextRing(r) }))
    .filter((x): x is { r: Reminder; at: Date } => x.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const rangRecently = reminders.filter(
    (r) => r.rangAt && now.getTime() - Date.parse(r.rangAt) < RECENT_MS && !r.snoozeUntil
  )
  // One-time reminders that already rang.
  const past = reminders
    .filter((r) => !nextRing(r))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))

  const row = (r: Reminder, at: Date | null): React.JSX.Element =>
    editing === r.id ? (
      <li key={r.id} className="reminder-item is-editing">
        <ReminderEditor
          initial={r}
          onSave={(draft) => {
            window.api.reminders.update(r.id, draft).catch(fail('update the reminder'))
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      </li>
    ) : (
      <li key={r.id} className="reminder-item">
        <div className="reminder-text">
          <strong>{r.title}</strong>
          <span className="reminder-when">
            {at ? describeWhen(at, now) : t('Ya sonó', 'Already rang')}
            {r.snoozeUntil ? t(' · pospuesto', ' · snoozed') : ''}
            {full && r.repeat.kind !== 'once' ? ` · ${describeReminderRepeat(r.repeat)}` : ''}
          </span>
        </div>
        {full && (
          <button
            className="icon-button"
            title={t('Editar', 'Edit')}
            aria-label={t(`Editar ${r.title}`, `Edit ${r.title}`)}
            onClick={() => setEditing(r.id)}
          >
            ✏️
          </button>
        )}
        <button
          className="icon-button"
          title={t('Borrar', 'Delete')}
          aria-label={t(`Borrar ${r.title}`, `Delete ${r.title}`)}
          onClick={() => remove(r)}
        >
          ×
        </button>
      </li>
    )

  return (
    <div className={`reminders${full ? ' is-full' : ''}`}>
      {rangRecently.length > 0 && (
        <section className="reminders-rang" aria-label={t('Acaban de sonar', 'Just rang')}>
          {rangRecently.map((r) => (
            <div key={r.id} className="reminder-rang">
              <span>⏰ {r.title}</span>
              <div className="reminder-rang-actions">
                <button
                  className="button-ghost"
                  onClick={() => window.api.reminders.snooze(r.id, 10).catch(fail('snooze'))}
                >
                  +10 min
                </button>
                {full && (
                  <button
                    className="button-ghost"
                    onClick={() => window.api.reminders.snooze(r.id, 60).catch(fail('snooze'))}
                  >
                    {t('+1 hora', '+1 hour')}
                  </button>
                )}
                <button
                  className="button-primary"
                  onClick={() => window.api.reminders.dismiss(r.id).catch(fail('dismiss'))}
                >
                  {t('Listo', 'Done')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <ReminderEditor
        compact={!full}
        saveLabel={t('+ Recordarme', '+ Remind me')}
        onSave={create}
      />

      {undo && (
        <div className="reminders-undo">
          {t('Borrado.', 'Deleted.')}{' '}
          <button
            className="button-ghost"
            onClick={() => {
              window.api.reminders.restore(undo).catch(fail('restore the reminder'))
              setUndo(null)
            }}
          >
            {t('Deshacer', 'Undo')}
          </button>
        </div>
      )}

      {full && <h2>{t('Próximos', 'Coming up')}</h2>}
      {upcoming.length === 0 ? (
        <p className="reminder-hint">
          {t(
            'Nada pendiente. Escribe qué te recuerdo y a qué hora, y te aviso.',
            "Nothing coming up. Write what to remind you of and when, and I'll let you know."
          )}
        </p>
      ) : (
        <ul className="reminder-list">
          {(full ? upcoming : upcoming.slice(0, 5)).map(({ r, at }) => row(r, at))}
        </ul>
      )}

      {full && past.length > 0 && (
        <>
          <h2>{t('Ya sonaron', 'Already rang')}</h2>
          <ul className="reminder-list is-past">{past.map((r) => row(r, null))}</ul>
        </>
      )}

      {full && (
        <p className="reminder-hint">
          {t(
            'Suenan como aviso de la Mac aunque cierres la ventana: Nuggit solo tiene que estar abierto (en la barra de menú basta).',
            'They ring as a Mac notification even if you close the window: Nuggit just has to be open (the menu bar is enough).'
          )}
          {openAtLogin === false && (
            <>
              {' '}
              <button
                className="button-ghost"
                onClick={() =>
                  window.api.app
                    .setOpenAtLogin(true)
                    .then((info) => setOpenAtLogin(info.openAtLogin))
                    .catch(fail('turn on open at login'))
                }
              >
                {t('Abrir Nuggit al prender la Mac', 'Open Nuggit when the Mac starts')}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
