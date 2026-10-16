import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskStatus } from '../../../../shared/types'
import { useTasks } from '../../store/useTasks'
import { useToday } from '../../store/useToday'
import type { WidgetProps } from '../types'
import { groupTasks, subtasksOf, type GroupKey } from './grouping'
import { TaskItem } from './TaskItem'
import './tasks.css'

export type TasksFilter = 'today' | 'pending' | 'done'

export interface TasksConfig {
  collapsed: Partial<Record<GroupKey, boolean>> // groups folded by the user
  filter?: TasksFilter // full size only
}

// Full size only: simple filters. The widget shows everything still to do.
const FILTERS: Array<{ key: TasksFilter; label: string; groups: GroupKey[] }> = [
  { key: 'today', label: 'Hoy', groups: ['doing', 'overdue', 'today'] },
  {
    key: 'pending',
    label: 'Pendientes',
    groups: ['doing', 'overdue', 'today', 'upcoming', 'someday']
  },
  { key: 'done', label: 'Hechas', groups: ['done'] }
]

type Undo =
  | { kind: 'removed'; removed: Task[]; label: string }
  | { kind: 'completed'; id: string; previous: TaskStatus; label: string }

// Never show a wall of tasks: each group shows a few until "Ver más".
const VISIBLE_PER_GROUP = 5
const UNDO_MS = 6000

function emptyText(filter: TasksFilter): string {
  if (filter === 'today') return 'Nada para hoy. ¡Bien! 🌤️'
  if (filter === 'done') return 'Todavía no hay tareas hechas. Ya llegarán ✨'
  return 'Nada pendiente por aquí. Escribe arriba lo primero que se te ocurra ✨'
}

export function TasksWidget({
  size,
  config,
  updateConfig
}: WidgetProps<TasksConfig>): React.JSX.Element {
  const store = useTasks()
  const today = useToday()
  const [newTitle, setNewTitle] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState<Partial<Record<GroupKey, boolean>>>({})
  const [undo, setUndo] = useState<Undo | null>(null)
  const full = size === 'full'
  const filter = FILTERS.find((f) => f.key === (config.filter ?? 'pending')) ?? FILTERS[1]

  const tasks = store.tasks
  const allGroups = useMemo(() => (tasks ? groupTasks(tasks, today) : []), [tasks, today])
  // Finished tasks leave the list; at full size they can still be seen under "Hechas".
  const shownKeys = full ? filter.groups : FILTERS[1].groups
  const groups = allGroups.filter((g) => shownKeys.includes(g.key))
  const doneTasks = allGroups.find((g) => g.key === 'done')?.tasks ?? []

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

  const remove = (task: Task, label = task.parentId ? 'Paso borrado' : 'Tarea borrada'): void => {
    store.removeTask(task.id).then((removed) => {
      if (removed.length) setUndo({ kind: 'removed', removed, label })
    })
  }

  // A finished task leaves the list right away; "Deshacer" brings it back.
  const complete = (task: Task): void => {
    store.updateTask(task.id, { status: 'done' })
    setUndo({ kind: 'completed', id: task.id, previous: task.status, label: '¡Tarea hecha! ✅' })
  }

  const removeDone = (): void => {
    const count = doneTasks.length
    if (
      !window.confirm(
        count === 1 ? '¿Borrar la tarea hecha?' : `¿Borrar las ${count} tareas hechas?`
      )
    )
      return
    Promise.all(doneTasks.map((t) => store.removeTask(t.id))).then((lists) => {
      const removed = lists.flat()
      if (removed.length) setUndo({ kind: 'removed', removed, label: 'Hechas borradas' })
    })
  }

  const undoLast = (): void => {
    if (!undo) return
    if (undo.kind === 'removed') store.restoreTasks(undo.removed)
    else store.updateTask(undo.id, { status: undo.previous })
    setUndo(null)
  }

  return (
    <div className={`tasks${full ? ' is-full' : ''}`}>
      {full && (
        <div className="task-filters" role="tablist" aria-label="Filtro de tareas">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={f.key === filter.key}
              className={`task-filter${f.key === filter.key ? ' is-active' : ''}`}
              onClick={() => updateConfig({ filter: f.key })}
            >
              {f.label}
            </button>
          ))}
          {filter.key === 'done' && doneTasks.length > 0 && (
            <button className="button-ghost task-filters-action" onClick={removeDone}>
              🗑 Borrar hechas
            </button>
          )}
        </div>
      )}
      {filter.key !== 'done' || !full ? (
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
      ) : null}

      <div className="task-groups">
        {groups.length === 0 && (
          <p className="tasks-empty">{emptyText(full ? filter.key : 'pending')}</p>
        )}
        {groups.map((group) => {
          const isCollapsed = collapsed[group.key] ?? (group.key === 'done' && !full)
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
                        onComplete={complete}
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
          <button className="button-ghost" onClick={undoLast}>
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}
