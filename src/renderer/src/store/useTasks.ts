import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskInput } from '../../../shared/types'

// Shared task data. Any widget that needs tasks reads them from here, never from
// another widget. The main process owns the list and sends every change to all windows.
export interface TasksStore {
  tasks: Task[] | null // null while loading
  createTask(input: TaskInput & { title: string; parentId?: string }): void
  updateTask(id: string, patch: TaskInput): void
  removeTask(id: string): Promise<Task[]>
  restoreTasks(tasks: Task[]): void
}

const report = (err: unknown): void => console.error('Could not change tasks', err)

export function useTasks(): TasksStore {
  const [tasks, setTasks] = useState<Task[] | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.tasks
      .load()
      .then((loaded) => {
        if (!cancelled) setTasks((prev) => prev ?? loaded)
      })
      .catch((err) => {
        console.error('Could not load tasks', err)
        if (!cancelled) setTasks((prev) => prev ?? [])
      })
    const unsubscribe = window.api.tasks.onChange(setTasks)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const createTask = useCallback<TasksStore['createTask']>((input) => {
    window.api.tasks.create(input).catch(report)
  }, [])

  const updateTask = useCallback<TasksStore['updateTask']>((id, patch) => {
    window.api.tasks.update(id, patch).catch(report)
  }, [])

  const removeTask = useCallback<TasksStore['removeTask']>(
    (id) =>
      window.api.tasks.remove(id).catch((err) => {
        report(err)
        return []
      }),
    []
  )

  const restoreTasks = useCallback<TasksStore['restoreTasks']>((removed) => {
    window.api.tasks.restore(removed).catch(report)
  }, [])

  return { tasks, createTask, updateTask, removeTask, restoreTasks }
}
