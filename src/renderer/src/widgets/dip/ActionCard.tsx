import { useState } from 'react'
import type { DipAction, DipActionEdits, DipChatMessage, Priority } from '../../../../shared/types'
import { useTasks } from '../../store/useTasks'

const PRIORITY_LABELS: Record<Priority, string> = { high: 'Alta', medium: 'Normal', low: 'Baja' }

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  })
}

function header(action: DipAction): string {
  if (action.type === 'create') return '📝 Anotar tarea'
  if (action.type === 'complete') return '✅ Marcar como hecha'
  return '✏️ Cambiar tarea'
}

// What will change, in short lines.
function details(action: DipAction): string[] {
  if (action.type === 'complete') return [action.taskTitle]
  const fields = action.type === 'create' ? action : action.changes
  const lines = action.type === 'create' ? [action.title] : [action.taskTitle]
  const arrow = action.type === 'update' ? '→ ' : ''
  if (action.type === 'update' && fields.title) lines.push(`Nombre ${arrow}${fields.title}`)
  if (fields.dueDate) lines.push(`📅 ${arrow}${formatDate(fields.dueDate)}`)
  else if (action.type === 'update' && fields.dueDate === '') lines.push('📅 → sin fecha')
  if (fields.priority)
    lines.push(`Prioridad ${arrow}${PRIORITY_LABELS[fields.priority].toLowerCase()}`)
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
    const result = await window.api.dipChat
      .applyAction(message.id, edits)
      .catch(() => ({ ok: false, error: 'No pude guardarlo. Intenta otra vez.' }))
    if (result.ok) setEditing(false)
    else setError(result.error ?? 'No pude guardarlo.')
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
            Guardar
          </button>
          <button className="button-ghost" onClick={() => setEditing(true)}>
            Cambiar
          </button>
          <button
            className="button-ghost"
            onClick={() => window.api.dipChat.cancelAction(message.id)}
          >
            Cancelar
          </button>
        </div>
      )}
      {state === 'saved' && (
        <div className="dip-action-buttons">
          <span className="dip-action-state">Guardado ✓</span>
          <button
            className="button-ghost"
            onClick={() => window.api.dipChat.undoAction(message.id)}
          >
            Deshacer
          </button>
        </div>
      )}
      {state === 'cancelled' && <span className="dip-action-state">Cancelado</span>}
      {state === 'undone' && <span className="dip-action-state">Deshecho</span>}
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
        <select value={taskId} aria-label="Tarea" onChange={(e) => setTaskId(e.target.value)}>
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
            aria-label="Nombre"
            placeholder={action.type === 'update' ? 'Nombre (igual)' : 'Nombre'}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="dip-action-row">
            <input
              type="date"
              value={dueDate}
              aria-label="Fecha"
              onChange={(e) => setDueDate(e.target.value)}
            />
            <select
              value={priority}
              aria-label="Prioridad"
              onChange={(e) => setPriority(e.target.value as Priority | '')}
            >
              <option value="">Prioridad…</option>
              <option value="high">Alta</option>
              <option value="medium">Normal</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </>
      )}
      <div className="dip-action-buttons">
        <button type="submit" className="button-primary">
          Guardar
        </button>
        <button type="button" className="button-ghost" onClick={onCancel}>
          Volver
        </button>
      </div>
    </form>
  )
}
