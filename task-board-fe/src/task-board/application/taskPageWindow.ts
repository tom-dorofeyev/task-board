import type { Task, TaskStatus } from '../domain/task'
import type {
  TaskBoardSnapshot,
  TaskPage,
  TaskPageInfo,
} from './ports/TaskQueries'

export interface TaskQueryIdentity {
  readonly status: TaskStatus
  readonly sort: 'board-order'
  readonly filterIdentity: string
}

export type TaskPageRequestIntent = 'initial' | 'append' | 'replace'

export interface TaskPageRequest {
  readonly query: TaskQueryIdentity
  readonly generation: number
  readonly intent: TaskPageRequestIntent
  readonly continuationToken?: string
}

export type TaskPageRequestState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'loading'
      readonly request: TaskPageRequest
    }
  | {
      readonly status: 'error'
      readonly request: TaskPageRequest
      readonly message: string
    }

export interface TaskPageWindow {
  readonly query: TaskQueryIdentity
  readonly page: TaskPage
  readonly requestGeneration: number
  readonly initialRequest: TaskPageRequestState
  readonly continuationRequest: TaskPageRequestState
}

export type TaskBoardPageWindows = Readonly<Record<TaskStatus, TaskPageWindow>>

export const BOARD_ORDER_QUERY = (
  status: TaskStatus,
  filterIdentity = 'all',
): TaskQueryIdentity => ({ status, sort: 'board-order', filterIdentity })

export const createTaskPageWindow = (
  query: TaskQueryIdentity,
  page: TaskPage = EMPTY_TASK_PAGE,
): TaskPageWindow => ({
  query,
  page,
  requestGeneration: 0,
  initialRequest: { status: 'idle' },
  continuationRequest: { status: 'idle' },
})

export const createTaskBoardPageWindows = (
  snapshot: TaskBoardSnapshot,
): TaskBoardPageWindows => ({
  todo: createTaskPageWindow(BOARD_ORDER_QUERY('todo'), snapshot.todo),
  'in-progress': createTaskPageWindow(
    BOARD_ORDER_QUERY('in-progress'),
    snapshot['in-progress'],
  ),
  done: createTaskPageWindow(BOARD_ORDER_QUERY('done'), snapshot.done),
})

export const beginTaskPageRequest = (
  window: TaskPageWindow,
  intent: TaskPageRequestIntent,
  continuationToken?: string,
): TaskPageWindow => {
  const request: TaskPageRequest = {
    query: window.query,
    generation: window.requestGeneration + 1,
    intent,
    ...(continuationToken === undefined ? {} : { continuationToken }),
  }
  const loading = { status: 'loading' as const, request }
  return {
    ...window,
    requestGeneration: request.generation,
    initialRequest: intent === 'initial' ? loading : window.initialRequest,
    continuationRequest: intent === 'initial' ? { status: 'idle' } : loading,
  }
}

export const resolveTaskPageRequest = (
  window: TaskPageWindow,
  request: TaskPageRequest,
  page: TaskPage,
): TaskPageWindow => {
  if (!isActiveRequest(window, request)) return window
  return {
    ...window,
    page:
      request.intent === 'append'
        ? appendTaskPage(window.page, page)
        : replaceTaskPage(page),
    initialRequest:
      request.intent === 'initial' ? { status: 'idle' } : window.initialRequest,
    continuationRequest: { status: 'idle' },
  }
}

export const rejectTaskPageRequest = (
  window: TaskPageWindow,
  request: TaskPageRequest,
  message: string,
): TaskPageWindow => {
  if (!isActiveRequest(window, request)) return window
  const failure = { status: 'error' as const, request, message }
  return {
    ...window,
    initialRequest:
      request.intent === 'initial' ? failure : window.initialRequest,
    continuationRequest:
      request.intent === 'initial' ? { status: 'idle' } : failure,
  }
}

export const retryTaskPageRequest = (
  window: TaskPageWindow,
): TaskPageWindow => {
  const failed =
    window.continuationRequest.status === 'error'
      ? window.continuationRequest
      : window.initialRequest.status === 'error'
        ? window.initialRequest
        : undefined
  return failed === undefined
    ? window
    : beginTaskPageRequest(
        window,
        failed.request.intent,
        failed.request.continuationToken,
      )
}

export const resetTaskPageQuery = (
  window: TaskPageWindow,
  query: TaskQueryIdentity,
): TaskPageWindow =>
  sameTaskQuery(window.query, query)
    ? window
    : {
        ...createTaskPageWindow(query),
        requestGeneration: window.requestGeneration + 1,
      }

export const transitionTaskBoardPageWindows = (
  windows: TaskBoardPageWindows,
  transition: (snapshot: TaskBoardSnapshot) => TaskBoardSnapshot,
): TaskBoardPageWindows => {
  const next = transition(getTaskBoardSnapshot(windows))
  return {
    todo: replaceWindowPage(windows.todo, next.todo),
    'in-progress': replaceWindowPage(
      windows['in-progress'],
      next['in-progress'],
    ),
    done: replaceWindowPage(windows.done, next.done),
  }
}

export const getTaskBoardSnapshot = (
  windows: TaskBoardPageWindows,
): TaskBoardSnapshot => ({
  todo: windows.todo.page,
  'in-progress': windows['in-progress'].page,
  done: windows.done.page,
})

const EMPTY_TASK_PAGE: TaskPage = {
  items: [],
  totalCount: 0,
  pageInfo: {},
}

const isActiveRequest = (
  window: TaskPageWindow,
  request: TaskPageRequest,
): boolean => {
  const state =
    request.intent === 'initial'
      ? window.initialRequest
      : window.continuationRequest
  return (
    state.status === 'loading' &&
    request.generation === window.requestGeneration &&
    state.request.generation === request.generation &&
    sameTaskQuery(window.query, request.query)
  )
}

const appendTaskPage = (current: TaskPage, incoming: TaskPage): TaskPage => ({
  items: mergeTaskItems(current.items, incoming.items),
  totalCount: incoming.totalCount,
  pageInfo: appendPageInfo(current.pageInfo, incoming.pageInfo),
})

const replaceTaskPage = (page: TaskPage): TaskPage => ({
  ...page,
  items: mergeTaskItems([], page.items),
})

const mergeTaskItems = (
  current: readonly Task[],
  incoming: readonly Task[],
): readonly Task[] => {
  const byId = new Map(current.map((task) => [task.id, task]))
  incoming.forEach((task) => byId.set(task.id, task))
  return [...byId.values()]
}

const appendPageInfo = (
  current: TaskPageInfo,
  incoming: TaskPageInfo,
): TaskPageInfo => ({
  ...(current.previousToken === undefined
    ? {}
    : { previousToken: current.previousToken }),
  ...(incoming.nextToken === undefined
    ? {}
    : { nextToken: incoming.nextToken }),
})

const replaceWindowPage = (
  window: TaskPageWindow,
  page: TaskPage,
): TaskPageWindow =>
  window.page === page
    ? window
    : {
        ...window,
        page,
        requestGeneration: window.requestGeneration + 1,
        initialRequest: { status: 'idle' },
        continuationRequest: { status: 'idle' },
      }

const sameTaskQuery = (
  left: TaskQueryIdentity,
  right: TaskQueryIdentity,
): boolean =>
  left.status === right.status &&
  left.sort === right.sort &&
  left.filterIdentity === right.filterIdentity
