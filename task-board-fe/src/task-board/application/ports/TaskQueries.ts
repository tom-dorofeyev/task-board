import type { Task, TaskStatus } from '../../domain/task'

export interface TaskListRequest {
  readonly status: TaskStatus
  readonly sort?: 'board-order'
  readonly filterIdentity?: string
  readonly continuationToken?: string
}

export interface TaskPageInfo {
  readonly nextToken?: string
  readonly previousToken?: string
}

export interface TaskPage {
  readonly items: readonly Task[]
  readonly totalCount: number
  readonly pageInfo: TaskPageInfo
}

export type TaskBoardSnapshot = Readonly<Record<TaskStatus, TaskPage>>

export interface TaskQueries {
  listTasks(request: TaskListRequest): Promise<TaskPage>
  getTask(id: string): Promise<Task | null>
}
