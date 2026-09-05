import type {
  CreateTaskInput,
  MoveTaskInput,
  MoveTaskResult,
  UpdateTaskInput,
} from '../../../task-board/application/ports/TaskCommands.js'
import type { TaskPage } from '../../../task-board/application/ports/TaskQueries.js'
import {
  moveTask,
  moveTaskBefore,
  tasksByStatus,
  type Task,
  type TaskStatus,
} from '../../../task-board/domain/task.js'
import { createSeedTasks } from '../../../task-board/infrastructure/persistence/seedTasks.js'

export class MockTaskBoard {
  private tasks = createSeedTasks()
  private readonly createdTasks = new Map<string, Task>()

  list(status: TaskStatus): TaskPage {
    const items = tasksByStatus(this.tasks, status)
    return { items, totalCount: items.length, pageInfo: {} }
  }

  get(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id)
  }

  create(input: CreateTaskInput): Task {
    const existing = this.createdTasks.get(input.idempotencyKey)
    if (existing !== undefined) return existing
    const task: Task = {
      ...input.task,
      id: crypto.randomUUID(),
      key: nextTaskKey(this.tasks),
      position: tasksByStatus(this.tasks, input.task.status).length,
    }
    this.tasks = [...this.tasks, task]
    this.createdTasks.set(input.idempotencyKey, task)
    return task
  }

  update(input: UpdateTaskInput): Task | undefined {
    const existing = this.get(input.id)
    if (existing === undefined) return undefined
    const moved =
      existing.status === input.task.status
        ? this.tasks
        : moveTask(
            this.tasks,
            existing.id,
            input.task.status,
            tasksByStatus(this.tasks, input.task.status).length,
          )
    this.tasks = moved.map((task) =>
      task.id === input.id ? { ...task, ...input.task } : task,
    )
    return this.get(input.id)
  }

  delete(id: string): boolean {
    const task = this.get(id)
    if (task === undefined) return false
    this.tasks = this.tasks.filter((candidate) => candidate.id !== id)
    const positions = new Map(
      tasksByStatus(this.tasks, task.status).map((candidate, position) => [
        candidate.id,
        position,
      ]),
    )
    this.tasks = this.tasks.map((candidate) => ({
      ...candidate,
      position: positions.get(candidate.id) ?? candidate.position,
    }))
    return true
  }

  move(input: MoveTaskInput): MoveTaskResult | undefined {
    const task = this.get(input.taskId)
    if (task === undefined) return undefined
    const anchor =
      input.beforeTaskId === null ? undefined : this.get(input.beforeTaskId)
    if (anchor !== undefined && anchor.status !== input.targetStatus)
      return undefined
    const tasks =
      anchor === undefined
        ? moveTask(
            this.tasks,
            task.id,
            input.targetStatus,
            tasksByStatus(this.tasks, input.targetStatus).length,
          )
        : moveTaskBefore(this.tasks, task.id, anchor.id)
    const moved = tasks.find((candidate) => candidate.id === task.id)
    if (moved === undefined) return undefined
    this.tasks = tasks
    const affectedStatuses = new Set([task.status, moved.status])
    return {
      task: moved,
      previousStatus: task.status,
      affectedTasks: tasks.filter((candidate) =>
        affectedStatuses.has(candidate.status),
      ),
    }
  }
}

function nextTaskKey(tasks: readonly Task[]): string {
  const largest = tasks.reduce(
    (current, task) =>
      Math.max(current, Number(task.key.split('-').at(-1)) || 0),
    100,
  )
  return `NEX-${largest + 1}`
}
