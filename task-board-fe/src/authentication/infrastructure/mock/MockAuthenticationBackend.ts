import type { AuthenticatedUser } from '../../application/ports/AuthenticationService.js'
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../../shared/infrastructure/http/HttpClient.js'
import type {
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
} from '../../../task-board/application/ports/TaskCommands.js'
import type { TaskStatus } from '../../../task-board/domain/task.js'
import { MockTaskBoard } from './MockTaskBoard.js'

const SESSION_COOKIE_NAME = 'task_board_session'

export type TaskAccess = 'allowed' | 'forbidden'

export interface MockAuthenticationBackendOptions {
  readonly user?: AuthenticatedUser
  readonly password?: string
  readonly taskAccess?: TaskAccess
}

export class MockAuthenticationBackend implements HttpClient {
  private readonly user: AuthenticatedUser
  private readonly password: string
  private readonly taskAccess: TaskAccess
  private readonly sessions = new Set<string>()
  private readonly taskBoards = new Map<string, MockTaskBoard>()

  constructor(options: MockAuthenticationBackendOptions = {}) {
    this.user = options.user ?? defaultUser()
    this.password = options.password ?? 'demo-password'
    this.taskAccess = options.taskAccess ?? 'allowed'
  }

  async execute(request: HttpRequest): Promise<HttpResponse> {
    return this.handle(request)
  }

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const authenticationResponse = this.authenticationResponse(request)
    if (authenticationResponse !== undefined) return authenticationResponse
    if (request.method === 'GET' && taskPath(request.path) === '/tasks') {
      return this.tasksResponse(request)
    }
    if (request.method === 'POST' && taskPath(request.path) === '/tasks') {
      return this.createTaskResponse(request)
    }
    const taskId = taskIdFor(request.path)
    if (taskId !== undefined) return this.taskResponse(request, taskId)
    const allowedMethod = allowedMethodFor(request.path)
    if (allowedMethod !== undefined)
      return methodNotAllowedResponse(allowedMethod)
    return response(404, { error: 'not_found' })
  }

  private authenticationResponse(
    request: HttpRequest,
  ): HttpResponse | undefined {
    if (request.method === 'GET' && request.path === '/auth/session')
      return this.sessionResponse(request)
    if (request.method === 'POST' && request.path === '/auth/login')
      return this.loginResponse(request)
    if (request.method === 'POST' && request.path === '/auth/logout')
      return this.logoutResponse(request)
    return undefined
  }

  private sessionResponse(request: HttpRequest): HttpResponse {
    if (!this.hasActiveSession(request))
      return response(401, { error: 'unauthorized' })
    return response(200, { user: this.user })
  }

  private loginResponse(request: HttpRequest): HttpResponse {
    if (!this.hasValidCredentials(request.body)) {
      return response(401, { error: 'invalid_credentials' })
    }
    const sessionId = this.createSession()
    return response(
      200,
      { user: this.user },
      sessionCookie(SESSION_COOKIE_NAME, sessionId),
    )
  }

  private logoutResponse(request: HttpRequest): HttpResponse {
    const sessionId = this.sessionId(request)
    if (sessionId === undefined || !this.sessions.delete(sessionId)) {
      return response(401, { error: 'unauthorized' })
    }
    return response(204, undefined, expiredSessionCookie(SESSION_COOKIE_NAME))
  }

  private tasksResponse(request: HttpRequest): HttpResponse {
    const board = this.authorizedTaskBoard(request)
    if (!(board instanceof MockTaskBoard)) return board
    const status = taskStatus(request.path)
    if (status === undefined) return response(200, { items: [] })
    return response(200, board.list(status))
  }

  private taskResponse(request: HttpRequest, taskId: string): HttpResponse {
    const board = this.authorizedTaskBoard(request)
    if (!(board instanceof MockTaskBoard)) return board
    return this.taskOperationResponse(request, board, taskId)
  }

  private taskOperationResponse(
    request: HttpRequest,
    board: MockTaskBoard,
    taskId: string,
  ): HttpResponse {
    if (request.method === 'GET') return this.taskDetailsResponse(board, taskId)
    if (isTaskUpdateRequest(request))
      return this.updateTaskResponse(board, taskId, request.body)
    if (isTaskMoveRequest(request))
      return this.moveTaskResponse(board, taskId, request.body)
    return methodNotAllowedResponse(
      taskPath(request.path).endsWith('/move') ? 'POST' : 'GET, PUT',
    )
  }

  private taskDetailsResponse(
    board: MockTaskBoard,
    taskId: string,
  ): HttpResponse {
    const task = board.get(taskId)
    return task === undefined
      ? response(404, { error: 'not_found' })
      : response(200, task)
  }

  private updateTaskResponse(
    board: MockTaskBoard,
    taskId: string,
    task: UpdateTaskInput['task'],
  ): HttpResponse {
    const updatedTask = board.update({ id: taskId, task })
    return updatedTask === undefined
      ? response(404, { error: 'not_found' })
      : response(200, updatedTask)
  }

  private moveTaskResponse(
    board: MockTaskBoard,
    taskId: string,
    input: Omit<MoveTaskInput, 'taskId'>,
  ): HttpResponse {
    const result = board.move({ taskId, ...input })
    return result === undefined
      ? response(404, { error: 'not_found' })
      : response(200, result)
  }

  private taskBoard(request: HttpRequest): MockTaskBoard | undefined {
    const sessionId = this.sessionId(request)
    if (sessionId === undefined || !this.sessions.has(sessionId))
      return undefined
    let board = this.taskBoards.get(sessionId)
    if (board === undefined) {
      board = new MockTaskBoard()
      this.taskBoards.set(sessionId, board)
    }
    return board
  }

  private createTaskResponse(request: HttpRequest): HttpResponse {
    const board = this.authorizedTaskBoard(request)
    if (!(board instanceof MockTaskBoard)) return board
    if (!isCreateTask(request.body)) return methodNotAllowedResponse('GET')
    return response(200, board.create(request.body))
  }

  private authorizedTaskBoard(
    request: HttpRequest,
  ): MockTaskBoard | HttpResponse {
    const board = this.taskBoard(request)
    if (board === undefined) return response(401, { error: 'unauthorized' })
    if (this.taskAccess === 'forbidden')
      return response(403, { error: 'forbidden' })
    return board
  }

  private hasValidCredentials(body: unknown): boolean {
    return (
      isCredentials(body) &&
      body.username === this.user.username &&
      body.password === this.password
    )
  }

  private hasActiveSession(request: HttpRequest): boolean {
    const sessionId = this.sessionId(request)
    return sessionId !== undefined && this.sessions.has(sessionId)
  }

  private sessionId(request: HttpRequest): string | undefined {
    return readCookie(request.headers?.cookie, SESSION_COOKIE_NAME)
  }

  private createSession(): string {
    const sessionId = crypto.randomUUID()
    this.sessions.add(sessionId)
    return sessionId
  }
}

function defaultUser(): AuthenticatedUser {
  return { id: 'demo-user', username: 'demo', displayName: 'Demo User' }
}

function isCredentials(
  value: unknown,
): value is { readonly username: string; readonly password: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'username' in value &&
    typeof value.username === 'string' &&
    'password' in value &&
    typeof value.password === 'string'
  )
}

function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (header === undefined) return undefined
  return header
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([cookieName]) => cookieName === name)
    ?.at(1)
}

function response(
  status: number,
  body?: unknown,
  setCookie?: string,
): HttpResponse {
  return {
    status,
    headers: setCookie === undefined ? {} : { 'set-cookie': setCookie },
    body,
  }
}

function allowedMethodFor(path: string): 'GET' | 'POST' | undefined {
  if (path === '/auth/session' || taskPath(path) === '/tasks') return 'GET'
  if (path === '/auth/login' || path === '/auth/logout') return 'POST'
  return undefined
}

function taskPath(path: string): string {
  return path.split('?')[0]
}

function taskStatus(path: string): TaskStatus | undefined {
  const status = new URL(path, 'http://localhost').searchParams.get('status')
  return status === 'todo' || status === 'in-progress' || status === 'done'
    ? status
    : undefined
}

function taskIdFor(path: string): string | undefined {
  const match = /^\/tasks\/([^/?]+)(?:\/move)?(?:\?.*)?$/.exec(path)
  return match === null ? undefined : decodeURIComponent(match[1])
}

function isUpdateTask(value: unknown): value is UpdateTaskInput['task'] {
  return isTaskDraft(value)
}

function isTaskUpdateRequest(
  request: HttpRequest,
): request is HttpRequest & { readonly body: UpdateTaskInput['task'] } {
  return request.method === 'PUT' && isUpdateTask(request.body)
}

function isCreateTask(value: unknown): value is CreateTaskInput {
  return (
    isRecord(value) &&
    typeof value.idempotencyKey === 'string' &&
    isTaskDraft(value.task)
  )
}

function isMoveTask(value: unknown): value is Omit<MoveTaskInput, 'taskId'> {
  return (
    isRecord(value) &&
    isTaskStatus(value.targetStatus) &&
    (typeof value.beforeTaskId === 'string' || value.beforeTaskId === null)
  )
}

function isTaskMoveRequest(request: HttpRequest): request is HttpRequest & {
  readonly body: Omit<MoveTaskInput, 'taskId'>
} {
  return (
    request.method === 'POST' &&
    taskPath(request.path).endsWith('/move') &&
    isMoveTask(request.body)
  )
}

function isTaskDraft(value: unknown): value is UpdateTaskInput['task'] {
  return (
    isRecord(value) &&
    hasStringProperties(value, ['title', 'description', 'assignee']) &&
    isTaskStatus(value.status) &&
    isTaskPriority(value.priority) &&
    hasStringArray(value.labels)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasStringProperties(
  value: Record<string, unknown>,
  properties: readonly string[],
): boolean {
  return properties.every((property) => typeof value[property] === 'string')
}

function hasStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isTaskStatus(value: unknown): boolean {
  return value === 'todo' || value === 'in-progress' || value === 'done'
}

function isTaskPriority(value: unknown): boolean {
  return value === 'low' || value === 'medium' || value === 'high'
}

function methodNotAllowedResponse(method: string): HttpResponse {
  return {
    status: 405,
    headers: { allow: method },
    body: { error: 'method_not_allowed' },
  }
}

function sessionCookie(name: string, value: string): string {
  return `${name}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax`
}

function expiredSessionCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; Max-Age=0; Path=/; SameSite=Lax`
}
