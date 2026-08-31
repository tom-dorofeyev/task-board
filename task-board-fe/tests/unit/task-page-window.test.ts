import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BOARD_ORDER_QUERY,
  beginTaskPageRequest,
  createTaskBoardPageWindows,
  createTaskPageWindow,
  getTaskBoardSnapshot,
  rejectTaskPageRequest,
  resetTaskPageQuery,
  resolveTaskPageRequest,
  retryTaskPageRequest,
  transitionTaskBoardPageWindows,
} from '../../src/task-board/application/taskPageWindow'
import { TaskBoardPageController } from '../../src/task-board/application/TaskBoardPageController'
import type {
  TaskListRequest,
  TaskPage,
  TaskQueries,
} from '../../src/task-board/application/ports/TaskQueries'
import type { Task } from '../../src/task-board/domain/task'

const FIRST: Task = {
  id: 'first',
  key: 'NEX-1',
  title: 'First',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Sam Lee',
  labels: [],
  position: 0,
}

const SECOND: Task = { ...FIRST, id: 'second', key: 'NEX-2', position: 1 }

describe('task page window', () => {
  it('appends unique IDs and authoritatively replaces duplicate entities', () => {
    const original = page([FIRST], 2, { nextToken: 'next' })
    const requested = beginTaskPageRequest(
      createTaskPageWindow(BOARD_ORDER_QUERY('todo'), original),
      'append',
      'next',
    )
    const request = loadingRequest(requested, 'continuationRequest')
    const replacement = { ...FIRST, title: 'Authoritative' }

    const result = resolveTaskPageRequest(
      requested,
      request,
      page([replacement, SECOND], 2, {}),
    )

    assert.deepEqual(result.page.items, [replacement, SECOND])
    assert.equal(result.page.totalCount, 2)
    assert.deepEqual(result.page.pageInfo, {})
  })

  it('ignores an obsolete response after a newer request starts', () => {
    const firstRequestState = beginTaskPageRequest(
      createTaskPageWindow(BOARD_ORDER_QUERY('todo')),
      'initial',
    )
    const obsolete = loadingRequest(firstRequestState, 'initialRequest')
    const current = beginTaskPageRequest(firstRequestState, 'initial')

    const result = resolveTaskPageRequest(
      current,
      obsolete,
      page([FIRST], 1, {}),
    )

    assert.equal(result, current)
  })

  it('ignores an initial response after a newer append request starts', () => {
    const initialState = beginTaskPageRequest(
      createTaskPageWindow(
        BOARD_ORDER_QUERY('todo'),
        page([FIRST], 2, { nextToken: 'next' }),
      ),
      'initial',
    )
    const initial = loadingRequest(initialState, 'initialRequest')
    const appended = beginTaskPageRequest(initialState, 'append', 'next')

    const result = resolveTaskPageRequest(
      appended,
      initial,
      page([SECOND], 2, {}),
    )

    assert.equal(result, appended)
  })

  it('replaces a window instead of preserving earlier items', () => {
    const requested = beginTaskPageRequest(
      createTaskPageWindow(
        BOARD_ORDER_QUERY('todo'),
        page([FIRST], 2, { nextToken: 'next' }),
      ),
      'replace',
      'next',
    )

    const result = resolveTaskPageRequest(
      requested,
      loadingRequest(requested, 'continuationRequest'),
      page([SECOND], 2, { previousToken: 'previous' }),
    )

    assert.deepEqual(result.page.items, [SECOND])
    assert.deepEqual(result.page.pageInfo, { previousToken: 'previous' })
  })

  it('retains content and continuation data after a failed continuation', () => {
    const original = page([FIRST], 2, { nextToken: 'next' })
    const requested = beginTaskPageRequest(
      createTaskPageWindow(BOARD_ORDER_QUERY('todo'), original),
      'append',
      'next',
    )

    const result = rejectTaskPageRequest(
      requested,
      loadingRequest(requested, 'continuationRequest'),
      'Try again',
    )

    assert.equal(result.page, original)
    assert.deepEqual(result.continuationRequest, {
      status: 'error',
      request: loadingRequest(requested, 'continuationRequest'),
      message: 'Try again',
    })
    assert.deepEqual(result.initialRequest, { status: 'idle' })
  })

  it('retries a failed continuation with a new generation', () => {
    const requested = beginTaskPageRequest(
      createTaskPageWindow(BOARD_ORDER_QUERY('todo')),
      'append',
      'next',
    )
    const failed = rejectTaskPageRequest(
      requested,
      loadingRequest(requested, 'continuationRequest'),
      'Try again',
    )

    const result = retryTaskPageRequest(failed)

    assert.equal(result.continuationRequest.status, 'loading')
    assert.equal(result.requestGeneration, 2)
    assert.equal(
      result.continuationRequest.status === 'loading'
        ? result.continuationRequest.request.continuationToken
        : undefined,
      'next',
    )
  })

  it('invalidates the window and cursor when query identity changes', () => {
    const requested = beginTaskPageRequest(
      createTaskPageWindow(
        BOARD_ORDER_QUERY('todo'),
        page([FIRST], 2, { nextToken: 'next' }),
      ),
      'append',
      'next',
    )

    const result = resetTaskPageQuery(
      requested,
      BOARD_ORDER_QUERY('todo', 'assignee:sam'),
    )

    assert.deepEqual(result.page, page([], 0, {}))
    assert.deepEqual(result.initialRequest, { status: 'idle' })
    assert.deepEqual(result.continuationRequest, { status: 'idle' })
    assert.equal(result.requestGeneration, 2)
  })

  it('tracks request generations independently for every status', () => {
    const empty = page([], 0, {})
    const windows = createTaskBoardPageWindows({
      todo: empty,
      'in-progress': empty,
      done: empty,
    })

    const todo = beginTaskPageRequest(windows.todo, 'initial')
    const done = beginTaskPageRequest(
      beginTaskPageRequest(windows.done, 'initial'),
      'replace',
      'done-page',
    )

    assert.equal(todo.requestGeneration, 1)
    assert.equal(done.requestGeneration, 2)
    assert.equal(windows['in-progress'].requestGeneration, 0)
  })

  it('applies snapshot reconciliation through existing page windows', () => {
    const empty = page([], 0, {})
    const windows = createTaskBoardPageWindows({
      todo: page([FIRST], 1, {}),
      'in-progress': empty,
      done: empty,
    })

    const result = transitionTaskBoardPageWindows(windows, (snapshot) => ({
      ...snapshot,
      todo: page([{ ...FIRST, title: 'Changed' }], 1, {}),
    }))

    assert.equal(getTaskBoardSnapshot(result).todo.items[0]?.title, 'Changed')
    assert.equal(result.todo.requestGeneration, 1)
    assert.equal(result.done, windows.done)
  })
})

describe('task board page controller', () => {
  it('forms an append request from the active query and next token', async () => {
    const queries = new FakeTaskQueries()
    queries.responses.push(page([SECOND], 2, {}))
    const controller = controllerWithTodoPage(
      queries,
      page([FIRST], 2, { nextToken: 'next-page' }),
    )

    await controller.append('todo')

    assert.deepEqual(queries.requests, [
      {
        status: 'todo',
        sort: 'board-order',
        filterIdentity: 'all',
        continuationToken: 'next-page',
      },
    ])
    assert.deepEqual(controller.getState().todo.page.items, [FIRST, SECOND])
  })

  it('replaces a window using its previous token', async () => {
    const queries = new FakeTaskQueries()
    queries.responses.push(page([SECOND], 2, { nextToken: 'next-page' }))
    const controller = controllerWithTodoPage(
      queries,
      page([FIRST], 2, { previousToken: 'previous-page' }),
    )

    await controller.replace('todo', 'previous')

    assert.equal(queries.requests[0]?.continuationToken, 'previous-page')
    assert.deepEqual(controller.getState().todo.page.items, [SECOND])
  })

  it('retains a window and retries the rejected continuation', async () => {
    const queries = new FakeTaskQueries()
    queries.responses.push(new Error('offline'), page([SECOND], 2, {}))
    const original = page([FIRST], 2, { nextToken: 'next-page' })
    const controller = controllerWithTodoPage(queries, original)

    await assert.rejects(controller.append('todo'), /offline/)
    assert.equal(controller.getState().todo.page, original)
    assert.equal(controller.getState().todo.continuationRequest.status, 'error')
    await controller.retry('todo')

    assert.equal(queries.requests[1]?.continuationToken, 'next-page')
    assert.deepEqual(controller.getState().todo.page.items, [FIRST, SECOND])
  })

  it('resets a changed query before loading its initial page', async () => {
    const queries = new FakeTaskQueries()
    queries.responses.push(page([SECOND], 1, {}))
    const controller = controllerWithTodoPage(
      queries,
      page([FIRST], 1, { nextToken: 'obsolete' }),
    )

    controller.changeQuery(BOARD_ORDER_QUERY('todo', 'assignee:sam'))
    await controller.loadInitial('todo')

    assert.deepEqual(queries.requests[0], {
      status: 'todo',
      sort: 'board-order',
      filterIdentity: 'assignee:sam',
    })
    assert.deepEqual(controller.getState().todo.page.items, [SECOND])
  })

  it('discards a completion made obsolete by a query change', async () => {
    const queries = new DeferredTaskQueries()
    const controller = controllerWithTodoPage(queries, page([], 0, {}))
    const obsolete = controller.loadInitial('todo')

    controller.changeQuery(BOARD_ORDER_QUERY('todo', 'priority:high'))
    queries.pending[0]?.resolve(page([FIRST], 1, {}))
    await obsolete

    assert.deepEqual(controller.getState().todo.page.items, [])
    assert.equal(
      controller.getState().todo.query.filterIdentity,
      'priority:high',
    )
  })

  it('loads statuses simultaneously with independent generations', async () => {
    const queries = new DeferredTaskQueries()
    const controller = new TaskBoardPageController(queries)
    const todo = controller.loadInitial('todo')
    const done = controller.loadInitial('done')

    queries.pending[1]?.resolve(page([{ ...SECOND, status: 'done' }], 1, {}))
    queries.pending[0]?.resolve(page([FIRST], 1, {}))
    await Promise.all([todo, done])

    assert.equal(controller.getState().todo.requestGeneration, 1)
    assert.equal(controller.getState().done.requestGeneration, 1)
    assert.deepEqual(controller.getState().todo.page.items, [FIRST])
    assert.equal(controller.getState().done.page.items[0]?.status, 'done')
  })

  it('reports a throwing listener without failing a successful request', async () => {
    const queries = new FakeTaskQueries()
    queries.responses.push(page([FIRST], 1, {}))
    const reported: unknown[] = []
    const controller = new TaskBoardPageController(
      queries,
      undefined,
      (error) => reported.push(error),
    )
    let successfulNotifications = 0
    controller.subscribe(() => {
      throw new Error('broken listener')
    })
    controller.subscribe(() => {
      successfulNotifications += 1
    })

    await controller.loadInitial('todo')

    assert.deepEqual(controller.getState().todo.page.items, [FIRST])
    assert.equal(successfulNotifications, 2)
    assert.equal(reported.length, 2)
    assert.match(String(reported[0]), /broken listener/)
  })
})

const page = (
  items: readonly Task[],
  totalCount: number,
  pageInfo: TaskPage['pageInfo'],
): TaskPage => ({ items, totalCount, pageInfo })

const loadingRequest = (
  window: ReturnType<typeof createTaskPageWindow>,
  field: 'initialRequest' | 'continuationRequest',
) => {
  const state = window[field]
  if (state.status !== 'loading') throw new Error('Expected loading request')
  return state.request
}

class FakeTaskQueries implements TaskQueries {
  readonly requests: TaskListRequest[] = []
  readonly responses: Array<TaskPage | Error> = []

  async listTasks(request: TaskListRequest): Promise<TaskPage> {
    this.requests.push(request)
    const response = this.responses.shift()
    if (response instanceof Error) throw response
    if (response === undefined) throw new Error('Missing fake response')
    return response
  }

  async getTask(): Promise<Task | null> {
    return null
  }
}

class DeferredTaskQueries implements TaskQueries {
  readonly pending: Array<ReturnType<typeof deferred<TaskPage>>> = []

  listTasks(): Promise<TaskPage> {
    const response = deferred<TaskPage>()
    this.pending.push(response)
    return response.promise
  }

  async getTask(): Promise<Task | null> {
    return null
  }
}

const controllerWithTodoPage = (
  queries: TaskQueries,
  todo: TaskPage,
): TaskBoardPageController => {
  const empty = page([], 0, {})
  return new TaskBoardPageController(
    queries,
    createTaskBoardPageWindows({
      todo,
      'in-progress': empty,
      done: empty,
    }),
  )
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}
