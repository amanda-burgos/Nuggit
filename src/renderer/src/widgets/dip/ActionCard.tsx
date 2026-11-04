import { useState } from 'react'
import { locale, t } from '../../../../shared/i18n'
import type { DipAction, DipActionEdits, DipChatMessage, Priority } from '../../../../shared/types'
import { useTasks } from '../../store/useTasks'

const priorityLabels = (): Record<Priority, string> => ({
  high: t('Alta', 'High'),
  medium: t('Normal', 'Normal'),
  low: t('Baja', 'Low')
})

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  })
}

function header(action: DipAction): string {
  if (action.type === 'create') return t('📝 Anotar tarea', '📝 Add task')
  if (action.type === 'complete') return t('✅ Marcar como hecha', '✅ Mark as done')
  return t('✏️ Cambiar tarea', '✏️ Change task')
}

// What will change, in short lines.
function details(action: DipAction): string[] {
  if (action.type === 'complete') return [action.taskTitle]
  const fields = action.type === 'create' ? action : action.changes
  const lines = action.type === 'create' ? [action.title] : [action.taskTitle]
  const arrow = action.type === 'update' ? '→ ' : ''
  if (action.type === 'update' && fields.title)
    lines.push(`${t('Nombre', 'Name')} ${arrow}${fields.title}`)
  if (fields.dueDate) lines.push(`📅 ${arrow}${formatDate(fields.dueDate)}`)
  else if (action.type === 'update' && fields.dueDate === '')
    lines.push(t('📅 → sin fecha', '📅 → no date'))
  if (fields.priority)
    lines.push(
      `${t('Prioridad', 'Priority')} ${arrow}${priorityLabels()[fields.priority].toLowerCase()}`
    )
  return lines
}

// SPEC 8: Dip only proposes. The user saves, changes or cancels, and can undo afterwards.
export function ActionCard({ message }: { message: DipChatMessage }): React.JSX.Element | null {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const action = message.action
  if (!action) return null
  const state = message.actionState ?? 'pending'

  const apply = async (edits?: DipActionEdits): Promise<void> => {
    setError(null)
    const result = await window.api.dipChat.applyAction(message.id, edits).catch(() => ({
      ok: false,
      error: t('No pude guardarlo. Intenta otra vez.', 'I couldn’t save it. Try again.')
    }))
    if (result.ok) setEditing(false)
    else setError(result.error ?? t('No pude guardarlo.', 'I couldn’t save it.'))
  }

  return (
    <div className={`dip-action is-${state}`}>
      <div className="dip-action-header">{header(action)}</div>
      {editing ? (
        <ActionEditor action={action} onSave={apply} onCancel={() => setEditing(false)} />
      ) : (
        <ul className="dip-action-details">
          {details(action).map((line, i) => (
            <li key={i} className={i === 0 ? 'is-title' : ''}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="dip-action-error">{error}</p>}
      {state === 'pending' && !editing && (
        <div className="dip-action-buttons">
          <button className="button-primary" onClick={() => apply()}>
            {t('Guardar', 'Save')}
          </button>
          <button className="button-ghost" onClick={() => setEditing(true)}>
            {t('Cambiar', 'Change')}
          </button>
          <button
            className="button-ghost"
            onClick={() => window.api.dipChat.cancelAction(message.id)}
          >
            {t('Cancelar', 'Cancel')}
          </button>
        </div>
      )}
      {state === 'saved' && (
        <div className="dip-action-buttons">
          <span className="dip-action-state">{t('Guardado ✓', 'Saved ✓')}</span>
          <button
            className="button-ghost"
            onClick={() => window.api.dipChat.undoAction(message.id)}
          >
            {t('Deshacer', 'Undo')}
          </button>
        </div>
      )}
      {state === 'cancelled' && (
        <span className="dip-action-state">{t('Cancelado', 'Cancelled')}</span>
      )}
      {state === 'undone' && <span className="dip-action-state">{t('Deshecho', 'Undone')}</span>}
    </div>
  )
}

// "Cambiar": edit what will be saved before saving it.
function ActionEditor({
  action,
  onSave,
  onCancel
}: {
  action: DipAction
  onSave(edits: DipActionEdits): void
  onCancel(): void
}): React.JSX.Element {
  const { tasks } = useTasks()
  const fields = action.type === 'create' ? action : action.type === 'update' ? action.changes : {}
  const [title, setTitle] = useState(
    action.type === 'create' ? action.title : action.type === 'update' ? (fields.title ?? '') : ''
  )
  const [dueDate, setDueDate] = useState(fields.dueDate ?? '')
  const [priority, setPriority] = useState<Priority | ''>(fields.priority ?? '')
  const [taskId, setTaskId] = useState(action.type === 'create' ? '' : action.taskId)

  const pending = (tasks ?? []).filter((t) => t.status !== 'done')

  return (
    <form
      className="dip-action-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (action.type === 'complete') onSave({ taskId })
        else
          onSave({ ...(title.trim() ? { title } : {}), dueDate, ...(priority ? { priority } : {}) })
      }}
    >
      {action.type === 'complete' ? (
        <select
          value={taskId}
          aria-label={t('Tarea', 'Task')}
          onChange={(e) => setTaskId(e.target.value)}
        >
          {pending.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            value={title}
            aria-label={t('Nombre', 'Name')}
            placeholder={
              action.type === 'update' ? t('Nombre (igual)', 'Name (same)') : t('Nombre', 'Name')
            }
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="dip-action-row">
            <input
              type="date"
              value={dueDate}
              aria-label={t('Fecha', 'Date')}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <select
              value={priority}
              aria-label={t('Prioridad', 'Priority')}
              onChange={(e) => setPriority(e.target.value as Priority | '')}
            >
              <option value="">{t('Prioridad…', 'Priority…')}</option>
              <option value="high">{t('Alta', 'High')}</option>
              <option value="medium">{t('Normal', 'Normal')}</option>
              <option value="low">{t('Baja', 'Low')}</option>
            </select>
          </div>
        </>
      )}
      <div className="dip-action-buttons">
        <button type="submit" className="button-primary">
          {t('Guardar', 'Save')}
        </button>
        <button type="button" className="button-ghost" onClick={onCancel}>
          {t('Volver', 'Back')}
        </button>
      </div>
    </form>
  )
}
