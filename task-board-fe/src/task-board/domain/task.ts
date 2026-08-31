export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskId = string

export interface Task {
  readonly id: TaskId
  readonly key: string
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: TaskPriority
  readonly assignee: string
  readonly labels: readonly string[]
  readonly position: number
}

export const COLUMN_TITLES: Record<TaskStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
}

export function tasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.position - b.position)
}

export function moveTask(
  tasks: Task[],
  taskId: string,
  targetStatus: TaskStatus,
  targetPosition: number,
): Task[] {
  const movedTask = tasks.find((task) => task.id === taskId)
  if (!movedTask) return tasks
  const withoutMoved = tasks.filter((task) => task.id !== taskId)
  const targetTasks = tasksByStatus(withoutMoved, targetStatus)
  targetTasks.splice(
    Math.max(0, Math.min(targetPosition, targetTasks.length)),
    0,
    { ...movedTask, status: targetStatus },
  )
  const targetIds = new Set(targetTasks.map((task) => task.id))
  const positionedTarget = targetTasks.map((task, position) => ({
    ...task,
    position,
  }))
  const otherTasks = withoutMoved.filter((task) => !targetIds.has(task.id))
  return TASK_STATUSES.flatMap((status) => {
    const statusTasks =
      status === targetStatus
        ? positionedTarget
        : tasksByStatus(otherTasks, status).map((task, position) => ({
            ...task,
            position,
          }))
    return statusTasks
  })
}

export function moveTaskBefore(
  tasks: Task[],
  taskId: string,
  targetTaskId: string,
): Task[] {
  const target = tasks.find((task) => task.id === targetTaskId)
  const moved = tasks.find((task) => task.id === taskId)
  if (!target || !moved) return tasks
  const targetPosition =
    moved.status === target.status && moved.position < target.position
      ? target.position - 1
      : target.position
  return moveTask(tasks, taskId, target.status, targetPosition)
}
