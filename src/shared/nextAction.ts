import type { NextActionState, Priority, Task } from './types'

// SPEC 9.5: "¿Qué hago ahora?" without AI, with simple rules. Shared by the Next Action
// widget and the menu bar (9.11), so both always show the same task and the same step.

export interface NextAction {
  task: Task // what to do now: the next tender, or the task itself if it has none left
  root: Task // the big task it belongs to (the same task when it has no tenders)
  stepNumber?: number // when task is a tender: its place among the root's steps (1-based)
  stepCount?: number
  nextStep?: Task // the tender after this one
  minutes?: number
  started: boolean // the task (or this step) is "En curso"
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// Local date as YYYY-MM-DD (toISOString would use UTC and be off by a day at night).
export function toISODate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Skips and "how much time I have" only last for the day they were set.
export function activeState(state: NextActionState, today: string): NextActionState {
  return state.day === today ? state : { day: today, skipped: [], availableMin: null }
}

function actionFor(root: Task, tasks: Task[]): NextAction {
  const steps = tasks.filter((t) => t.parentId === root.id).sort((a, b) => a.order - b.order)
  const pending = steps.filter((t) => t.status !== 'done')
  // Rule 5: always the next small step, not the whole big task.
  const step = pending.find((t) => t.status === 'doing') ?? pending[0]
  if (!step) {
    return {
      task: root,
      root,
      minutes: root.estimateMin,
      started: root.status === 'doing'
    }
  }
  return {
    task: step,
    root,
    stepNumber: steps.indexOf(step) + 1,
    stepCount: steps.length,
    nextStep: pending.find((t) => t !== step),
    minutes: step.estimateMin,
    started: root.status === 'doing' || step.status === 'doing'
  }
}

// Up to `limit` actions, best first.
export function pickNextActions(
  tasks: Task[],
  savedState: NextActionState,
  today: string,
  limit = 3
): NextAction[] {
  const state = activeState(savedState, today)
  const actions = tasks
    .filter((t) => !t.parentId && t.status !== 'done')
    .map((root) => actionFor(root, tasks))
    // Rule 4: if the user said how much time they have, only what fits.
    .filter((a) => !state.availableMin || !a.minutes || a.minutes <= state.availableMin)

  // "Saltar" sends an action to the back of the line, in the order it was skipped.
  const skipRank = (a: NextAction): number => {
    const i = state.skipped.indexOf(a.task.id)
    return i === -1 ? -1 : i
  }
  actions.sort(
    (a, b) =>
      skipRank(a) - skipRank(b) ||
      // Rule 1: what you already started.
      Number(b.started) - Number(a.started) ||
      // Rule 2: closest due date (no date goes last).
      (a.root.dueDate ?? '9999').localeCompare(b.root.dueDate ?? '9999') ||
      // Rule 3: priority.
      PRIORITY_RANK[a.root.priority] - PRIORITY_RANK[b.root.priority] ||
      a.root.order - b.root.order
  )
  return actions.slice(0, limit)
}

// What Focus and Lockdown show (SPEC 9.8, 9.9): the chosen task while it is pending,
// otherwise the first Next Action.
export function focusAction(
  taskId: string | null,
  tasks: Task[],
  state: NextActionState,
  today: string
): NextAction | undefined {
  const task = tasks.find((t) => t.id === taskId && t.status !== 'done')
  if (!task) return pickNextActions(tasks, state, today, 1)[0]
  const root = (task.parentId && tasks.find((t) => t.id === task.parentId)) || task
  const action = actionFor(root, tasks)
  if (action.task.id === task.id || root === task) return action
  // A tender chosen out of order: its own place, and the pending step after it.
  const steps = tasks.filter((t) => t.parentId === root.id).sort((a, b) => a.order - b.order)
  const i = steps.indexOf(task)
  return {
    task,
    root,
    stepNumber: i + 1,
    stepCount: steps.length,
    nextStep: steps.slice(i + 1).find((t) => t.status !== 'done'),
    minutes: task.estimateMin,
    started: root.status === 'doing' || task.status === 'doing'
  }
}
