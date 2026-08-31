import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { TaskBoardBootstrap } from '../../src/task-board/application/ports/TaskBoardBootstrap'
import { TaskBoardPageController } from '../../src/task-board/application/TaskBoardPageController'
import type {
  TaskListRequest,
  TaskPage,
  TaskQueries,
} from '../../src/task-board/application/ports/TaskQueries'
import { BOARD_ORDER_QUERY } from '../../src/task-board/application/taskPageWindow'
import { LoadTaskBoard } from '../../src/task-board/application/use-cases/LoadTaskBoard'
import type { Task } from '../../src/task-board/domain/task'
import {
  TaskBoardInitialLoad,
  type TaskBoardLoadState,
} from '../../src/task-board/interface/react/TaskBoardInitialLoad'
import { useTaskBoardState } from '../../src/task-board/interface/react/useTaskBoardState'

const TASK: Task = {
  id: 'task-1',
  key: 'NEX-1',
  title: 'Recovered task',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'Sam Lee',
  labels: [],
  position: 0,
}

test('first bootstrap failure remains a global board failure', async () => {
  const queries = new ControllableTaskQueries()
  const bootstrap = new FailingBootstrap()
  const loadTaskBoard = new LoadTaskBoard(queries, bootstrap, () => [])

  const { result } = renderHook(() => useTaskBoardState(loadTaskBoard, queries))

  await waitFor(() => expect(result.current.loadState.status).toBe('error'))
})

test('later query failure and retry remain observable in the ready board', async () => {
  const queries = new ControllableTaskQueries()
  const bootstrap = new ReadyBootstrap()
  const loadTaskBoard = new LoadTaskBoard(queries, bootstrap, () => [])
  const { result } = renderHook(() => useTaskBoardState(loadTaskBoard, queries))
  await waitFor(() => expect(result.current.loadState.status).toBe('ready'))

  act(() => {
    result.current.pageController.changeQuery(
      BOARD_ORDER_QUERY('todo', 'priority:high'),
    )
  })
  expectReadyTodo(result.current.loadState, 'idle', [])

  const failedRequest = deferred<TaskPage>()
  queries.changedQueryResponses.push(failedRequest)
  let failure!: Promise<void>
  act(() => {
    failure = result.current.pageController.loadInitial('todo')
  })
  expectReadyTodo(result.current.loadState, 'loading', [])

  await act(async () => {
    failedRequest.reject(new Error('offline'))
    await expect(failure).rejects.toThrow('offline')
  })
  expectReadyTodo(result.current.loadState, 'error', [])

  const retryResponse = deferred<TaskPage>()
  queries.changedQueryResponses.push(retryResponse)
  let retry!: Promise<void>
  act(() => {
    retry = result.current.pageController.retry('todo')
  })
  expectReadyTodo(result.current.loadState, 'loading', [])

  await act(async () => {
    retryResponse.resolve({ items: [TASK], totalCount: 1, pageInfo: {} })
    await retry
  })
  expectReadyTodo(result.current.loadState, 'idle', [TASK])
})

test('stopped bootstrap generation never starts page requests', async () => {
  const bootstrap = new DeferredBootstrap()
  const queries = new DeferredInitialQueries()
  const controller = new TaskBoardPageController(queries)
  const published: TaskBoardLoadState[] = []
  const initialLoad = new TaskBoardInitialLoad({
    loadTaskBoard: new LoadTaskBoard(queries, bootstrap, () => []),
    pageController: controller,
    publishLoadState: (state) => published.push(state),
  })
  controller.subscribe(initialLoad.publishPageWindows)

  initialLoad.start()
  initialLoad.stop()
  initialLoad.start()
  bootstrap.requests[0]?.resolve(true)
  await flushPromises()

  expect(queries.requests).toHaveLength(0)
  expect(published).toHaveLength(0)

  bootstrap.requests[1]?.resolve(true)
  await waitFor(() => expect(queries.requests).toHaveLength(3))
  resolvePageBatch(queries, 0, 'Current')
  await waitFor(() => expect(published).toHaveLength(1))
})

test('stopped page batch cannot publish through a restarted lifecycle', async () => {
  const bootstrap = new DeferredBootstrap()
  const queries = new DeferredInitialQueries()
  const controller = new TaskBoardPageController(queries)
  const published: TaskBoardLoadState[] = []
  const initialLoad = new TaskBoardInitialLoad({
    loadTaskBoard: new LoadTaskBoard(queries, bootstrap, () => []),
    pageController: controller,
    publishLoadState: (state) => published.push(state),
  })
  controller.subscribe(initialLoad.publishPageWindows)

  initialLoad.start()
  bootstrap.requests[0]?.resolve(true)
  await waitFor(() => expect(queries.requests).toHaveLength(3))
  initialLoad.stop()
  initialLoad.start()
  resolvePageBatch(queries, 0, 'Obsolete')
  await flushPromises()

  expect(published).toHaveLength(0)

  bootstrap.requests[1]?.resolve(true)
  await waitFor(() => expect(queries.requests).toHaveLength(6))
  resolvePageBatch(queries, 3, 'Current')
  await waitFor(() => expect(published).toHaveLength(1))
  const ready = published[0]
  expect(ready?.status).toBe('ready')
  if (ready?.status === 'ready') {
    expect(ready.taskBoard.todo.items[0]?.title).toBe('Current')
  }
})

test('ready presenter failure is reported without board-unavailable translation', async () => {
  const bootstrap = new ReadyBootstrap()
  const queries = new ControllableTaskQueries()
  const controller = new TaskBoardPageController(queries)
  const reported: unknown[] = []
  let publicationAttempts = 0
  const initialLoad = new TaskBoardInitialLoad({
    loadTaskBoard: new LoadTaskBoard(queries, bootstrap, () => []),
    pageController: controller,
    publishLoadState: () => {
      publicationAttempts += 1
      throw new Error('presenter failed')
    },
    reportError: (error) => reported.push(error),
  })
  controller.subscribe(initialLoad.publishPageWindows)

  initialLoad.start()

  await waitFor(() => expect(reported).toHaveLength(1))
  expect(publicationAttempts).toBe(1)
  expect(String(reported[0])).toContain('presenter failed')
})

const expectReadyTodo = (
  state: ReturnType<typeof useTaskBoardState>['loadState'],
  requestStatus: 'idle' | 'loading' | 'error',
  items: readonly Task[],
) => {
  expect(state.status).toBe('ready')
  if (state.status !== 'ready') return
  expect(state.pageWindows.todo.initialRequest.status).toBe(requestStatus)
  expect(state.pageWindows.todo.page.items).toEqual(items)
}

class ReadyBootstrap implements TaskBoardBootstrap {
  async hasStoredBoard(): Promise<boolean> {
    return true
  }

  async initialize(): Promise<void> {}
}

class FailingBootstrap implements TaskBoardBootstrap {
  async hasStoredBoard(): Promise<boolean> {
    throw new Error('storage unavailable')
  }

  async initialize(): Promise<void> {}
}

class DeferredBootstrap implements TaskBoardBootstrap {
  readonly requests: Array<ReturnType<typeof deferred<boolean>>> = []

  hasStoredBoard(): Promise<boolean> {
    const request = deferred<boolean>()
    this.requests.push(request)
    return request.promise
  }

  async initialize(): Promise<void> {}
}

class ControllableTaskQueries implements TaskQueries {
  readonly changedQueryResponses: Array<ReturnType<typeof deferred<TaskPage>>> =
    []

  async listTasks(request: TaskListRequest): Promise<TaskPage> {
    if (request.filterIdentity === 'priority:high') {
      const response = this.changedQueryResponses.shift()
      if (response === undefined)
        throw new Error('Missing changed query response')
      return response.promise
    }
    return { items: [], totalCount: 0, pageInfo: {} }
  }

  async getTask(): Promise<Task | null> {
    return null
  }
}

class DeferredInitialQueries implements TaskQueries {
  readonly requests: Array<{
    request: TaskListRequest
    response: ReturnType<typeof deferred<TaskPage>>
  }> = []

  listTasks(request: TaskListRequest): Promise<TaskPage> {
    const response = deferred<TaskPage>()
    this.requests.push({ request, response })
    return response.promise
  }

  async getTask(): Promise<Task | null> {
    return null
  }
}

const resolvePageBatch = (
  queries: DeferredInitialQueries,
  offset: number,
  todoTitle: string,
) => {
  queries.requests
    .slice(offset, offset + 3)
    .forEach(({ request, response }) => {
      response.resolve({
        items: request.status === 'todo' ? [{ ...TASK, title: todoTitle }] : [],
        totalCount: request.status === 'todo' ? 1 : 0,
        pageInfo: {},
      })
    })
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete
    reject = fail
  })
  return { promise, resolve, reject }
}
