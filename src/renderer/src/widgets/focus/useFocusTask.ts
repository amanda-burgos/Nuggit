import { useMemo } from 'react'
import { focusAction, type NextAction } from '../../../../shared/nextAction'
import type { FocusState, Task, TaskStatusChange } from '../../../../shared/types'
import { useNextAction } from '../../store/useNextAction'
import { useTasks } from '../../store/useTasks'
import { useToday } from '../../store/useToday'

// The task Focus is about (the chosen one, or Next Action's) and the pending
// tasks to pick from.
export function useFocusTask(focus: FocusState | null): {
  action: NextAction | undefined
  pending: Array<{ task: Task; label: string }>
} {
  const { tasks } = useTasks()
  const nextState = useNextAction()
  const today = useToday()

  return useMemo(() => {
    if (!tasks || !nextState || !focus) return { action: undefined, pending: [] }
    const action = focusAction(focus.taskId, tasks, nextState, today)
    const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => a.order - b.order)
    const pending = open
      .filter((t) => !t.parentId)
      .flatMap((root) => [
        { task: root, label: root.title },
        ...open
          .filter((t) => t.parentId === root.id)
          .map((step) => ({ task: step, label: `${root.title} › ${step.title}` }))
      ])
    return { action, pending }
  }, [tasks, nextState, today, focus])
}

// "✅ Hecho" on the Focus task. Returns what changed, for "Deshacer".
export async function completeFocusTask(taskId: string): Promise<TaskStatusChange[]> {
  return window.api.tasks.complete(taskId)
}
