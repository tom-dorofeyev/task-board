import type { TaskStatus } from '../domain/task'
import type {
  TaskBoardSnapshot,
  TaskListRequest,
  TaskQueries,
} from './ports/TaskQueries'
import {
  BOARD_ORDER_QUERY,
  beginTaskPageRequest,
  createTaskPageWindow,
  rejectTaskPageRequest,
  resetTaskPageQuery,
  resolveTaskPageRequest,
  retryTaskPageRequest,
  transitionTaskBoardPageWindows,
  type TaskBoardPageWindows,
  type TaskPageRequest,
  type TaskPageRequestIntent,
  type TaskPageWindow,
  type TaskQueryIdentity,
} from './taskPageWindow'

export type TaskPageWindowListener = (windows: TaskBoardPageWindows) => void
export type TaskPageControllerErrorReporter = (error: unknown) => void

export class TaskBoardPageController {
  private readonly queries: TaskQueries
  private readonly reportError: TaskPageControllerErrorReporter
  private readonly listeners = new Set<TaskPageWindowListener>()
  private windows: TaskBoardPageWindows

  constructor(
    queries: TaskQueries,
    windows = createEmptyTaskBoardPageWindows(),
    reportError: TaskPageControllerErrorReporter = reportSubscriberError,
  ) {
    this.queries = queries
    this.windows = windows
    this.reportError = reportError
  }

  getState(): TaskBoardPageWindows {
    return this.windows
  }

  subscribe(listener: TaskPageWindowListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  loadInitial(status: TaskStatus): Promise<void> {
    return this.request(status, 'initial')
  }

  append(status: TaskStatus): Promise<void> {
    return this.requestWithToken(
      status,
      'append',
      this.windows[status].page.pageInfo.nextToken,
    )
  }

  replace(status: TaskStatus, direction: 'next' | 'previous'): Promise<void> {
    const pageInfo = this.windows[status].page.pageInfo
    return this.requestWithToken(
      status,
      'replace',
      direction === 'next' ? pageInfo.nextToken : pageInfo.previousToken,
    )
  }

  retry(status: TaskStatus): Promise<void> {
    const current = this.windows[status]
    const next = retryTaskPageRequest(current)
    if (next === current) return Promise.resolve()
    this.setWindow(status, next)
    return this.execute(status, getLatestLoadingRequest(next))
  }

  changeQuery(query: TaskQueryIdentity): void {
    this.setWindow(
      query.status,
      resetTaskPageQuery(this.windows[query.status], query),
    )
  }

  transition(
    transitionSnapshot: (snapshot: TaskBoardSnapshot) => TaskBoardSnapshot,
  ): void {
    this.setWindows(
      transitionTaskBoardPageWindows(this.windows, transitionSnapshot),
    )
  }

  private requestWithToken(
    status: TaskStatus,
    intent: 'append' | 'replace',
    continuationToken: string | undefined,
  ): Promise<void> {
    return continuationToken === undefined
      ? Promise.resolve()
      : this.request(status, intent, continuationToken)
  }

  private request(
    status: TaskStatus,
    intent: TaskPageRequestIntent,
    continuationToken?: string,
  ): Promise<void> {
    const next = beginTaskPageRequest(
      this.windows[status],
      intent,
      continuationToken,
    )
    this.setWindow(status, next)
    return this.execute(status, getLatestLoadingRequest(next))
  }

  private async execute(
    status: TaskStatus,
    request: TaskPageRequest,
  ): Promise<void> {
    let page
    try {
      page = await this.queries.listTasks(toTaskListRequest(request))
    } catch (error) {
      this.publishFailure(status, request)
      throw error
    }
    this.publishSuccess(status, request, page)
  }

  private publishSuccess(
    status: TaskStatus,
    request: TaskPageRequest,
    page: Awaited<ReturnType<TaskQueries['listTasks']>>,
  ): void {
    this.setWindow(
      status,
      resolveTaskPageRequest(this.windows[status], request, page),
    )
  }

  private publishFailure(status: TaskStatus, request: TaskPageRequest): void {
    this.setWindow(
      status,
      rejectTaskPageRequest(
        this.windows[status],
        request,
        'Task page could not be loaded.',
      ),
    )
  }

  private setWindow(status: TaskStatus, window: TaskPageWindow): void {
    if (window === this.windows[status]) return
    this.setWindows({ ...this.windows, [status]: window })
  }

  private setWindows(windows: TaskBoardPageWindows): void {
    if (windows === this.windows) return
    this.windows = windows
    this.listeners.forEach((listener) => {
      try {
        listener(windows)
      } catch (error) {
        this.reportError(error)
      }
    })
  }
}

const createEmptyTaskBoardPageWindows = (): TaskBoardPageWindows => ({
  todo: createTaskPageWindow(BOARD_ORDER_QUERY('todo')),
  'in-progress': createTaskPageWindow(BOARD_ORDER_QUERY('in-progress')),
  done: createTaskPageWindow(BOARD_ORDER_QUERY('done')),
})

const getLatestLoadingRequest = (window: TaskPageWindow): TaskPageRequest => {
  const state =
    window.continuationRequest.status === 'loading'
      ? window.continuationRequest
      : window.initialRequest
  if (state.status !== 'loading') {
    throw new Error('Expected an active task page request')
  }
  return state.request
}

const toTaskListRequest = (request: TaskPageRequest): TaskListRequest => ({
  status: request.query.status,
  sort: request.query.sort,
  filterIdentity: request.query.filterIdentity,
  ...(request.continuationToken === undefined
    ? {}
    : { continuationToken: request.continuationToken }),
})

const reportSubscriberError: TaskPageControllerErrorReporter = (error) => {
  console.error(error)
}
