import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { HttpResponse } from '../../src/shared/infrastructure/http/HttpClient'
import type {
  CookieHttpService,
  HttpRequestResult,
} from '../../src/shared/infrastructure/http/CookieHttpRequestBoundary'
import {
  HttpTaskRepository,
  TaskRequestError,
} from '../../src/task-board/infrastructure/http/HttpTaskRepository'
import type { Task } from '../../src/task-board/domain/task'

const TASK: Task = {
  id: 'task 1',
  key: 'NEX-1',
  title: 'Known task',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Sam Lee',
  labels: ['Test'],
  position: 0,
}

describe('HTTP task repository', () => {
  it('serializes the complete list query', async () => {
    const requests = new TaskRequests(pageResponse())
    const repository = new HttpTaskRepository(requests)

    await repository.listTasks({
      status: 'todo',
      sort: 'board-order',
      filterIdentity: 'team alpha',
      continuationToken: 'next page',
    })

    assert.equal(
      requests.paths[0],
      '/tasks?status=todo&sort=board-order&filterIdentity=team+alpha&continuationToken=next+page',
    )
  })

  it('returns null for a missing task', async () => {
    const repository = new HttpTaskRepository(new TaskRequests(response(404)))

    const task = await repository.getTask(TASK.id)

    assert.equal(task, null)
  })

  it('translates non-success statuses with task context', async () => {
    const repository = new HttpTaskRepository(new TaskRequests(response(503)))

    await assert.rejects(
      repository.createTask({ idempotencyKey: 'intent-1', task: draft() }),
      (error: unknown) =>
        error instanceof TaskRequestError &&
        error.message === 'Task could not be created.',
    )
  })

  it('does not expose transport failures', async () => {
    const transportError = new Error('socket unavailable')
    const repository = new HttpTaskRepository(new TaskRequests(transportError))

    await assert.rejects(
      repository.listTasks({ status: 'todo' }),
      (error: unknown) =>
        error instanceof TaskRequestError &&
        error.message === 'Task list could not be loaded.' &&
        error.cause === transportError,
    )
  })

  it('rejects malformed pagination and move status payloads', async () => {
    const malformedPage = response(200, {
      items: [TASK],
      totalCount: 1,
      pageInfo: { nextToken: 1 },
    })
    const malformedMove = response(200, {
      task: TASK,
      previousStatus: 'archived',
      affectedTasks: [TASK],
    })
    const requests = new TaskRequests([malformedPage, malformedMove])
    const repository = new HttpTaskRepository(requests)

    await assert.rejects(
      repository.listTasks({ status: 'todo' }),
      TaskRequestError,
    )
    await assert.rejects(
      repository.moveTask({
        taskId: TASK.id,
        targetStatus: 'done',
        beforeTaskId: null,
      }),
      TaskRequestError,
    )
  })

  it('posts move commands and returns the authoritative result', async () => {
    const moved = { ...TASK, status: 'done' as const, position: 2 }
    const move = {
      task: moved,
      previousStatus: 'todo' as const,
      affectedTasks: [moved],
    }
    const requests = new TaskRequests(response(200, move))
    const repository = new HttpTaskRepository(requests)
    const input = {
      taskId: TASK.id,
      targetStatus: 'done' as const,
      beforeTaskId: null,
    }

    const result = await repository.moveTask(input)

    assert.deepEqual(
      { path: requests.paths[0], body: requests.bodies[0], result },
      { path: '/tasks/task%201/move', body: input, result: move },
    )
  })
})

class TaskRequests implements CookieHttpService {
  readonly paths: string[] = []
  readonly bodies: unknown[] = []

  constructor(
    private readonly results:
      Array<HttpRequestResult | Error> | HttpRequestResult | Error,
  ) {}

  get(path: string): Promise<HttpRequestResult> {
    this.paths.push(path)
    return this.next()
  }

  post(path: string, body?: unknown): Promise<HttpRequestResult> {
    this.paths.push(path)
    this.bodies.push(body)
    return this.next()
  }

  put(path: string, body?: unknown): Promise<HttpRequestResult> {
    this.paths.push(path)
    this.bodies.push(body)
    return this.next()
  }

  delete(path: string): Promise<HttpRequestResult> {
    this.paths.push(path)
    return this.next()
  }

  private next(): Promise<HttpRequestResult> {
    const result = Array.isArray(this.results)
      ? this.results.shift()
      : this.results
    if (result === undefined)
      return Promise.reject(new Error('Missing response'))
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve(result)
  }
}

function pageResponse(): HttpResponse {
  return response(200, { items: [TASK], totalCount: 1, pageInfo: {} })
}

function response(status: number, body: unknown = undefined): HttpResponse {
  return { status, headers: {}, body }
}

function draft() {
  return {
    title: TASK.title,
    description: TASK.description,
    status: TASK.status,
    priority: TASK.priority,
    assignee: TASK.assignee,
    labels: TASK.labels,
  }
}
