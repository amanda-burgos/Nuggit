import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../../../../shared/types'
import { useTasks } from '../../store/useTasks'
import type { WidgetProps } from '../types'
import { groupTasks, subtasksOf, toISODate, type GroupKey } from './grouping'
import { TaskItem } from './TaskItem'
import './tasks.css'

export interface TasksConfig {
  collapsed: Partial<Record<GroupKey, boolean>> // groups folded by the user
}

// Never show a wall of tasks: each group shows a few until "Ver más".
const VISIBLE_PER_GROUP = 5
const UNDO_MS = 6000

// Today's date, refreshed every minute so groups move on at midnight.
function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setToday(toISODate(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  return today
}

export function TasksWidget({ config, updateConfig }: WidgetProps<TasksConfig>): React.JSX.Element {
  const store = useTasks()
  const today = useToday()
  const [newTitle, setNewTitle] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState<Partial<Record<GroupKey, boolean>>>({})
  const [undo, setUndo] = useState<{ removed: Task[]; label: string } | null>(null)

  const tasks = store.tasks
  const groups = useMemo(() => (tasks ? groupTasks(tasks, today) : []), [tasks, today])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  if (!tasks) return <div className="tasks" />

  const collapsed = config.collapsed ?? {}

  const add = (): void => {
    if (!newTitle.trim()) return
    store.createTask({ title: newTitle })
    setNewTitle('')
  }

  const remove = (task: Task): void => {
    store.removeTask(task.id).then((removed) => {
      if (removed.length)
        setUndo({ removed, label: task.parentId ? 'Paso borrado' : 'Tarea borrada' })
    })
  }

  return (
    <div className="tasks">
      <form
        className="task-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          value={newTitle}
          placeholder="¿Qué tienes que hacer?"
          aria-label="Nueva tarea"
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" className="button-primary" disabled={!newTitle.trim()}>
          Añadir
        </button>
      </form>

      <div className="task-groups">
        {groups.length === 0 && (
          <p className="tasks-empty">
            Nada pendiente por aquí. Escribe arriba lo primero que se te ocurra ✨
          </p>
        )}
        {groups.map((group) => {
          const isCollapsed = collapsed[group.key] ?? group.key === 'done'
          const visible = showAll[group.key] ? group.tasks : group.tasks.slice(0, VISIBLE_PER_GROUP)
          const hiddenCount = group.tasks.length - visible.length
          return (
            <section key={group.key} className={`task-group is-${group.key}`}>
              <button
                className="task-group-header"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  updateConfig({ collapsed: { ...collapsed, [group.key]: !isCollapsed } })
                }
              >
                <span className="task-group-arrow" aria-hidden>
                  {isCollapsed ? '▸' : '▾'}
                </span>
                {group.label}
                <span className="task-group-count">{group.tasks.length}</span>
              </button>
              {!isCollapsed && (
                <>
                  <ul className="task-list">
                    {visible.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        subtasks={subtasksOf(tasks, task.id)}
                        today={today}
                        expanded={expandedId === task.id}
                        onToggleExpanded={() =>
                          setExpandedId((id) => (id === task.id ? null : task.id))
                        }
                        store={store}
                        onRemove={remove}
                      />
                    ))}
                  </ul>
                  {(hiddenCount > 0 || showAll[group.key]) &&
                    group.tasks.length > VISIBLE_PER_GROUP && (
                      <button
                        className="task-more"
                        onClick={() => setShowAll((s) => ({ ...s, [group.key]: !s[group.key] }))}
                      >
                        {hiddenCount > 0 ? `Ver ${hiddenCount} más` : 'Ver menos'}
                      </button>
                    )}
                </>
              )}
            </section>
          )
        })}
      </div>

      {undo && (
        <div className="task-undo" role="status">
          <span>{undo.label}</span>
          <button
            className="button-ghost"
            onClick={() => {
              store.restoreTasks(undo.removed)
              setUndo(null)
            }}
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
