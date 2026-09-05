import type { Task, TaskId, TaskStatus } from '../../domain/task'
import type { TaskDraft } from '../../domain/taskValidation'

export interface CreateTaskInput {
  readonly idempotencyKey: string
  readonly task: TaskDraft
}

export interface UpdateTaskInput {
  readonly id: string
  readonly task: TaskDraft
}

export interface DeleteTaskInput {
  readonly id: TaskId
}

export interface MoveTaskInput {
  readonly taskId: TaskId
  readonly targetStatus: TaskStatus
  readonly beforeTaskId: TaskId | null
}

export interface MoveTaskResult {
  readonly task: Task
  readonly previousStatus: TaskStatus
  readonly affectedTasks: readonly Task[]
}

export interface TaskCommands {
  createTask(input: CreateTaskInput): Promise<Task>
  updateTask(input: UpdateTaskInput): Promise<Task>
  deleteTask(input: DeleteTaskInput): Promise<void>
  moveTask(input: MoveTaskInput): Promise<MoveTaskResult>
}
