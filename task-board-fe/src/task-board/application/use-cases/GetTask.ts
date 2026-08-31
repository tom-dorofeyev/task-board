import type { TaskQueries } from '../ports/TaskQueries'

export class GetTask {
  private readonly queries: TaskQueries

  constructor(queries: TaskQueries) {
    this.queries = queries
  }

  execute(id: string) {
    return this.queries.getTask(id)
  }
}
