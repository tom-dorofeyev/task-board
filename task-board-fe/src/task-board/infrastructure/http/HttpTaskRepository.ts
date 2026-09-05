import type { TaskBoardBootstrap } from '../../application/ports/TaskBoardBootstrap'
import type {
  CreateTaskInput,
  DeleteTaskInput,
  MoveTaskInput,
  MoveTaskResult,
  TaskCommands,
  UpdateTaskInput,
} from '../../application/ports/TaskCommands'
import type {
  TaskListRequest,
  TaskPage,
  TaskQueries,
} from '../../application/ports/TaskQueries'
import { TASK_STATUSES, type Task } from '../../domain/task'
import type { HttpResponse } from '../../../shared/infrastructure/http/HttpClient'
import {
  isUnauthorizedRequestResult,
  type CookieHttpService,
  type HttpRequestResult,
} from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'

export class TaskRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TaskRequestError'
  }
}

export class HttpTaskRepository
  implements TaskBoardBootstrap, TaskCommands, TaskQueries
{
  private readonly requests: CookieHttpService

  constructor(requests: CookieHttpService) {
    this.requests = requests
  }

  async hasStoredBoard(): Promise<boolean> {
    return true
  }

  async initialize(): Promise<void> {}

  async listTasks(request: TaskListRequest): Promise<TaskPage> {
    const query = new URLSearchParams({ status: request.status })
    if (request.sort !== undefined) query.set('sort', request.sort)
    if (request.filterIdentity !== undefined)
      query.set('filterIdentity', request.filterIdentity)
    if (request.continuationToken !== undefined) {
      query.set('continuationToken', request.continuationToken)
    }
    return taskPage(
      await this.get(`/tasks?${query}`, 'Task list could not be loaded.'),
    )
  }

  async getTask(id: string): Promise<Task | null> {
    const result = await this.requestResult(
      this.requests.get(`/tasks/${encodeURIComponent(id)}`),
      'Task details could not be loaded.',
    )
    if (result.status === 404) return null
    return task(this.success(result, 'Task details could not be loaded.'))
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return task(await this.post('/tasks', input, 'Task could not be created.'))
  }

  async updateTask(input: UpdateTaskInput): Promise<Task> {
    return task(
      await this.put(
        `/tasks/${encodeURIComponent(input.id)}`,
        input.task,
        'Task could not be updated.',
      ),
    )
  }

  async deleteTask(input: DeleteTaskInput): Promise<void> {
    await this.response(
      this.requests.delete(`/tasks/${encodeURIComponent(input.id)}`),
      'Task could not be deleted.',
      204,
    )
  }

  async moveTask(input: MoveTaskInput): Promise<MoveTaskResult> {
    return moveTaskResult(
      await this.post(
        `/tasks/${encodeURIComponent(input.taskId)}/move`,
        input,
        'Task could not be moved.',
      ),
    )
  }

  private async get(path: string, message: string): Promise<HttpResponse> {
    return this.response(this.requests.get(path), message)
  }

  private async post(
    path: string,
    body: unknown,
    message: string,
  ): Promise<HttpResponse> {
    return this.response(this.requests.post(path, body), message)
  }

  private async put(
    path: string,
    body: unknown,
    message: string,
  ): Promise<HttpResponse> {
    return this.response(this.requests.put(path, body), message)
  }

  private async response(
    request: Promise<HttpRequestResult>,
    message: string,
    expectedStatus = 200,
  ): Promise<HttpResponse> {
    return this.success(
      await this.requestResult(request, message),
      message,
      expectedStatus,
    )
  }

  private async requestResult(
    request: Promise<HttpRequestResult>,
    message: string,
  ): Promise<HttpResponse> {
    try {
      const result = await request
      if (isUnauthorizedRequestResult(result))
        throw new TaskRequestError(message)
      return result
    } catch (cause) {
      if (cause instanceof TaskRequestError) throw cause
      throw new TaskRequestError(message, { cause })
    }
  }

  private success(
    result: HttpResponse,
    message: string,
    expectedStatus = 200,
  ): HttpResponse {
    if (result.status !== expectedStatus) throw new TaskRequestError(message)
    return result
  }
}

function isTaskPage(value: unknown): value is TaskPage {
  return isRecord(value) && isTaskPageRecord(value)
}

function isMoveTaskResult(value: unknown): value is MoveTaskResult {
  return isRecord(value) && isMoveTaskResultRecord(value)
}

function isTaskPageInfo(value: unknown): boolean {
  return isRecord(value) && isTaskPageInfoRecord(value)
}

function isTaskStatus(value: unknown): value is (typeof TASK_STATUSES)[number] {
  return TASK_STATUSES.includes(value as never)
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false
  if (!hasStringProperties(value, stringTaskProperties)) return false
  if (!isTaskStatus(value.status)) return false
  if (!isTaskPriority(value.priority)) return false
  if (!hasStringArray(value, 'labels')) return false
  return hasNumberProperty(value, 'position')
}

const stringTaskProperties = ['id', 'key', 'title', 'description', 'assignee']

const isTaskPageRecord = (value: Record<string, unknown>): boolean => {
  return (
    hasTaskItems(value) &&
    hasNumberProperty(value, 'totalCount') &&
    isTaskPageInfo(value.pageInfo)
  )
}

const isMoveTaskResultRecord = (value: Record<string, unknown>): boolean => {
  return (
    isTask(value.task) &&
    isTaskStatus(value.previousStatus) &&
    hasAffectedTasks(value)
  )
}

const isTaskPageInfoRecord = (value: Record<string, unknown>): boolean => {
  return (
    isOptionalString(value.nextToken) && isOptionalString(value.previousToken)
  )
}

const hasTaskItems = (value: Record<string, unknown>): boolean => {
  return Array.isArray(value.items) && value.items.every(isTask)
}

const hasAffectedTasks = (value: Record<string, unknown>): boolean => {
  return Array.isArray(value.affectedTasks) && value.affectedTasks.every(isTask)
}

const isOptionalString = (value: unknown): boolean => {
  return value === undefined || typeof value === 'string'
}

const hasStringProperties = (
  value: Record<string, unknown>,
  properties: readonly string[],
): boolean => {
  return properties.every((property) => typeof value[property] === 'string')
}

const hasStringArray = (
  value: Record<string, unknown>,
  property: string,
): boolean => {
  return (
    Array.isArray(value[property]) &&
    value[property].every((item) => typeof item === 'string')
  )
}

const hasNumberProperty = (
  value: Record<string, unknown>,
  property: string,
): boolean => {
  return typeof value[property] === 'number'
}

const isTaskPriority = (value: unknown): boolean => {
  return value === 'low' || value === 'medium' || value === 'high'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

function taskPage(response: HttpResponse): TaskPage {
  if (!isTaskPage(response.body)) {
    throw new TaskRequestError('Task list was malformed.')
  }
  return response.body
}

function task(response: HttpResponse): Task {
  if (!isTask(response.body)) {
    throw new TaskRequestError('Task response was malformed.')
  }
  return response.body
}

function moveTaskResult(response: HttpResponse): MoveTaskResult {
  if (!isMoveTaskResult(response.body)) {
    throw new TaskRequestError('Task move response was malformed.')
  }
  return response.body
}
