import { useState } from 'react'
import type { Priority, Task, TaskInput } from '../../../../shared/types'
import { PRIORITY_LABELS } from './grouping'

interface Props {
  task: Task
  onSave(patch: TaskInput): void
  onCancel(): void
}

// Edits every field of a task. Nothing is saved until "Guardar".
export function TaskEditor({ task, onSave, onCancel }: Props): React.JSX.Element {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [estimate, setEstimate] = useState(task.estimateMin ? String(task.estimateMin) : '')
  const [category, setCategory] = useState(task.category ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')

  const canSave = title.trim().length > 0

  const save = (): void => {
    if (!canSave) return
    const minutes = Number(estimate)
    onSave({
      title,
      priority,
      dueDate: dueDate || null,
      estimateMin: estimate && minutes > 0 ? minutes : null,
      category: category || null,
      notes: notes || null
    })
  }

  return (
    <form
      className="task-editor"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <label className="task-field task-field-wide">
        <span>Tarea</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="task-field">
        <span>Prioridad</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {(['high', 'medium', 'low'] as const).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="task-field">
        <span>Para cuándo</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label className="task-field">
        <span>Minutos</span>
        <input
          type="number"
          min={1}
          step={5}
          inputMode="numeric"
          placeholder="ej: 25"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
        />
      </label>
      <label className="task-field">
        <span>Categoría</span>
        <input
          placeholder="ej: Ciencias"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>
      <label className="task-field task-field-wide">
        <span>Notas</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="task-editor-actions">
        <button type="button" className="button-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button-primary" disabled={!canSave}>
          Guardar
        </button>
      </div>
    </form>
  )
}
