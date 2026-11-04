import { locale, t } from '../../../../shared/i18n'
import type { Priority, Task } from '../../../../shared/types'

export type GroupKey = 'doing' | 'overdue' | 'today' | 'upcoming' | 'someday' | 'done'

export interface TaskGroup {
  key: GroupKey
  label: string
  tasks: Task[]
}

const groupLabels = (): Record<GroupKey, string> => ({
  doing: t('En curso', 'In progress'),
  overdue: t('Pendientes de antes', 'Left over'),
  today: t('Hoy', 'Today'),
  upcoming: t('Próximas', 'Coming up'),
  someday: t('Sin fecha', 'No date'),
  done: t('Hechas', 'Done')
})

const GROUP_ORDER: GroupKey[] = ['doing', 'overdue', 'today', 'upcoming', 'someday', 'done']

export const priorityLabels = (): Record<Priority, string> => ({
  high: t('Alta', 'High'),
  medium: t('Normal', 'Normal'),
  low: t('Baja', 'Low')
})

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Local date as YYYY-MM-DD (toISOString would use UTC and be off by a day at night).
export function toISODate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function groupOf(task: Task, today: string): GroupKey {
  if (task.status === 'done') return 'done'
  if (task.status === 'doing') return 'doing'
  if (!task.dueDate) return 'someday'
  if (task.dueDate < today) return 'overdue'
  if (task.dueDate === today) return 'today'
  return 'upcoming'
}

function compareTasks(a: Task, b: Task): number {
  return (
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.order - b.order
  )
}

// Top-level tasks split into small groups. Empty groups are left out.
export function groupTasks(tasks: Task[], today: string): TaskGroup[] {
  const byKey = new Map<GroupKey, Task[]>()
  for (const task of tasks) {
    if (task.parentId) continue
    const key = groupOf(task, today)
    byKey.set(key, [...(byKey.get(key) ?? []), task])
  }
  return GROUP_ORDER.filter((key) => byKey.has(key)).map((key) => {
    const list = byKey.get(key)!
    // Most recently finished first; everything else by date, then priority.
    list.sort((a, b) =>
      key === 'done' ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : compareTasks(a, b)
    )
    return { key, label: groupLabels()[key], tasks: list }
  })
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order)
}

// "Hoy", "Mañana", "Ayer", or a short date like "14 oct".
export function formatDue(dueDate: string, today: string): string {
  const day = new Date(`${dueDate}T00:00:00`)
  const diff = Math.round((day.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  if (diff === 0) return t('Hoy', 'Today')
  if (diff === 1) return t('Mañana', 'Tomorrow')
  if (diff === -1) return t('Ayer', 'Yesterday')
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4)
  return day.toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  })
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
