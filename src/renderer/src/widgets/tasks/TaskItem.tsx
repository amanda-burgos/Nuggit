import { useState } from 'react'
import { t } from '../../../../shared/i18n'
import type { Task } from '../../../../shared/types'
import type { TasksStore } from '../../store/useTasks'
import { formatDue, formatMinutes } from './grouping'
import { TaskEditor } from './TaskEditor'

interface Props {
  task: Task
  subtasks: Task[]
  today: string
  expanded: boolean
  onToggleExpanded(): void
  store: TasksStore
  onRemove(task: Task): void
  onComplete(task: Task): void
}

function CheckButton({
  done,
  small,
  title,
  onClick
}: {
  done: boolean
  small?: boolean
  title: string
  onClick(): void
}): React.JSX.Element {
  return (
    <button
      className={`task-check${done ? ' is-done' : ''}${small ? ' is-small' : ''}`}
      aria-pressed={done}
      title={
        done
          ? t('Marcar como pendiente', 'Mark as not done')
          : t('Marcar como hecha', 'Mark as done')
      }
      aria-label={`${done ? t('Desmarcar', 'Uncheck') : t('Marcar', 'Check')}: ${title}`}
      onClick={onClick}
    >
      ✓
    </button>
  )
}

// A tender (subtask): check it, rename it in place, or remove it.
function SubtaskRow({
  task,
  store,
  onRemove
}: {
  task: Task
  store: TasksStore
  onRemove(task: Task): void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const done = task.status === 'done'

  const finish = (save: boolean): void => {
    if (save && title.trim() && title !== task.title) store.updateTask(task.id, { title })
    else setTitle(task.title)
    setEditing(false)
  }

  return (
    <li className={`subtask${done ? ' is-done' : ''}`}>
      <CheckButton
        small
        done={done}
        title={task.title}
        onClick={() => store.updateTask(task.id, { status: done ? 'todo' : 'done' })}
      />
      {editing ? (
        <input
          className="subtask-input"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(true)
            if (e.key === 'Escape') finish(false)
          }}
        />
      ) : (
        <button
          className="subtask-title"
          title={t('Cambiar nombre', 'Rename')}
          onClick={() => setEditing(true)}
        >
          {task.title}
          {task.estimateMin ? (
            <span className="task-meta-item"> · {formatMinutes(task.estimateMin)}</span>
          ) : null}
        </button>
      )}
      <button
        className="icon-button subtask-remove"
        title={t('Quitar paso', 'Remove step')}
        aria-label={t(`Quitar paso: ${task.title}`, `Remove step: ${task.title}`)}
        onClick={() => onRemove(task)}
      >
        ×
      </button>
    </li>
  )
}

export function TaskItem({
  task,
  subtasks,
  today,
  expanded,
  onToggleExpanded,
  store,
  onRemove,
  onComplete
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [newStep, setNewStep] = useState('')
  const done = task.status === 'done'
  const doneSteps = subtasks.filter((t) => t.status === 'done').length

  const addStep = (): void => {
    if (!newStep.trim()) return
    store.createTask({ title: newStep, parentId: task.id })
    setNewStep('')
  }

  const overdue = !done && task.dueDate !== undefined && task.dueDate < today

  return (
    <li className={`task${done ? ' is-done' : ''}${expanded ? ' is-expanded' : ''}`}>
      <div className="task-row">
        <CheckButton
          done={done}
          title={task.title}
          onClick={() => (done ? store.updateTask(task.id, { status: 'todo' }) : onComplete(task))}
        />
        <button className="task-main" aria-expanded={expanded} onClick={onToggleExpanded}>
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            {task.status === 'doing' && (
              <span className="task-chip is-doing">{t('En curso', 'In progress')}</span>
            )}
            {task.dailyId && (
              <span className="task-meta-item" title={t('Daily: se repite', 'Daily: repeats')}>
                🔁
              </span>
            )}
            {task.priority === 'high' && !done && (
              <span className="task-chip is-high">{t('Prioridad alta', 'High priority')}</span>
            )}
            {task.dueDate && (
              <span className={`task-meta-item${overdue ? ' is-overdue' : ''}`}>
                📅 {formatDue(task.dueDate, today)}
              </span>
            )}
            {task.estimateMin ? (
              <span className="task-meta-item">⏱ {formatMinutes(task.estimateMin)}</span>
            ) : null}
            {task.category && <span className="task-meta-item">🏷 {task.category}</span>}
            {subtasks.length > 0 && (
              <span className="task-meta-item">
                {doneSteps}/{subtasks.length} {t('pasos', 'steps')}
              </span>
            )}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="task-details">
          {editing ? (
            <TaskEditor
              task={task}
              onCancel={() => setEditing(false)}
              onSave={(patch) => {
                store.updateTask(task.id, patch)
                setEditing(false)
              }}
            />
          ) : (
            <>
              {task.notes && <p className="task-notes">{task.notes}</p>}

              {subtasks.length > 0 && (
                <ul className="subtasks">
                  {subtasks.map((sub) => (
                    <SubtaskRow key={sub.id} task={sub} store={store} onRemove={onRemove} />
                  ))}
                </ul>
              )}
              <form
                className="subtask-add"
                onSubmit={(e) => {
                  e.preventDefault()
                  addStep()
                }}
              >
                <input
                  value={newStep}
                  placeholder={t('+ Añadir un paso chiquito', '+ Add a tiny step')}
                  aria-label={t('Nuevo paso', 'New step')}
                  onChange={(e) => setNewStep(e.target.value)}
                />
              </form>

              <div className="task-actions">
                {!done && (
                  <button
                    className="button-ghost"
                    onClick={() =>
                      store.updateTask(task.id, {
                        status: task.status === 'doing' ? 'todo' : 'doing'
                      })
                    }
                  >
                    {task.status === 'doing' ? t('⏸ Pausar', '⏸ Pause') : t('▶ Empezar', '▶ Start')}
                  </button>
                )}
                <button className="button-ghost" onClick={() => setEditing(true)}>
                  {t('✏️ Editar', '✏️ Edit')}
                </button>
                <button className="button-ghost task-delete" onClick={() => onRemove(task)}>
                  {t('🗑 Borrar', '🗑 Delete')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}
