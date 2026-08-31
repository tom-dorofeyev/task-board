import { TASK_STATUSES, type Task } from '../../domain/task'
import type { TaskBoardBootstrap } from '../ports/TaskBoardBootstrap'
import type { TaskBoardSnapshot, TaskQueries } from '../ports/TaskQueries'

export class LoadTaskBoard {
  private readonly queries: TaskQueries
  private readonly bootstrap: TaskBoardBootstrap
  private readonly createInitialTasks: () => Task[]

  constructor(
    queries: TaskQueries,
    bootstrap: TaskBoardBootstrap,
    createInitialTasks: () => Task[],
  ) {
    this.queries = queries
    this.bootstrap = bootstrap
    this.createInitialTasks = createInitialTasks
  }

  async execute(): Promise<TaskBoardSnapshot> {
    await this.initialize()
    const [todo, inProgress, done] = await Promise.all(
      TASK_STATUSES.map((status) => this.queries.listTasks({ status })),
    )
    return { todo, 'in-progress': inProgress, done }
  }

  async initialize(): Promise<void> {
    if (await this.bootstrap.hasStoredBoard()) return
    await this.bootstrap.initialize(this.createInitialTasks())
  }
}
