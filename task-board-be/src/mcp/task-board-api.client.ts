import type {
  MoveTaskResult,
  Task,
  TaskDraft,
  TaskStatus,
} from '../tasks/domain/task.js';

export interface TaskPage {
  items: Task[];
  totalCount: number;
  pageInfo: { nextToken?: string; previousToken?: string };
}
export interface TaskBoardUser {
  id: string;
  username: string;
  displayName: string;
}

export class TaskBoardApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class TaskBoardApiClient {
  private sessionCookie?: string;

  constructor(
    private readonly baseUrl: string,
    sessionCookie?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!baseUrl) throw new Error('TASK_BOARD_API_URL is required');
    this.sessionCookie = sessionCookie;
  }

  async whoami(): Promise<TaskBoardUser> {
    return (await this.request('/auth/session')).user as TaskBoardUser;
  }
  async listTasks(input: {
    status: TaskStatus;
    sort?: 'board-order';
    filterIdentity?: string;
    continuationToken?: string;
  }): Promise<TaskPage> {
    return this.request(
      `/tasks?${new URLSearchParams(removeUndefined(input)).toString()}`,
    );
  }
  async getTask(taskId: string): Promise<Task> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }
  async createTask(input: {
    idempotencyKey: string;
    task: TaskDraft;
  }): Promise<Task> {
    return this.request('/tasks', 'POST', input);
  }
  async updateTask(taskId: string, task: TaskDraft): Promise<Task> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`, 'PUT', task);
  }
  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/tasks/${encodeURIComponent(taskId)}`, 'DELETE');
  }
  async moveTask(input: {
    taskId: string;
    targetStatus: TaskStatus;
    beforeTaskId: string | null;
  }): Promise<MoveTaskResult> {
    return this.request(
      `/tasks/${encodeURIComponent(input.taskId)}/move`,
      'POST',
      input,
    );
  }

  private async request(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<any> {
    const response = await this.fetcher(
      new URL(path, this.baseUrl),
      this.requestOptions(method, body),
    );
    this.rememberSession(response);
    const payload = await this.readJson(response);
    if (!response.ok) throw this.apiError(response.status, payload);
    return payload;
  }

  private requestOptions(method: string, body: unknown): RequestInit {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.sessionCookie) headers.Cookie = this.sessionCookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };
  }

  private rememberSession(response: Response): void {
    const session = response.headers.get('set-cookie');
    if (session?.startsWith('task_board_session='))
      this.sessionCookie = session.split(';')[0];
  }

  private async readJson(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new TaskBoardApiError(
        502,
        'invalid_response',
        'The Task Board API returned invalid JSON',
      );
    }
  }

  private apiError(
    status: number,
    payload: Record<string, unknown>,
  ): TaskBoardApiError {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : 'The Task Board API request failed';
    const code =
      status === 401
        ? 'authentication_required'
        : status === 403
          ? 'access_denied'
          : status === 404
            ? 'not_found'
            : 'request_failed';
    return new TaskBoardApiError(status, code, message);
  }
}

function removeUndefined(
  input: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}
