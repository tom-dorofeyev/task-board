import { ApplicationError } from '../../shared/application-error.js';
import {
  TASK_STATUSES,
  type MoveTaskResult,
  type PageInfo,
  type Task,
  type TaskStatus,
} from '../domain/task.js';
import {
  assertValidListQuery,
  requiredString,
  taskDraftFrom,
  taskStatusFrom,
} from '../domain/task-input.validator.js';
import type { TaskCursorCodec } from './task-cursor-codec.js';
import type { TaskIdGenerator } from './task-id-generator.js';
import type { TaskRepository } from './task-repository.js';
const PAGE_SIZE = 50;

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly cursorCodec: TaskCursorCodec,
    private readonly taskIds: TaskIdGenerator,
  ) {}

  async list(
    userId: string,
    query: Record<string, unknown>,
  ): Promise<{ items: Task[]; totalCount: number; pageInfo: PageInfo }> {
    const status = taskStatusFrom(query.status);
    assertValidListQuery(query);
    const offset = this.cursorCodec.offset(query.continuationToken, {
      userId,
      status,
      filterIdentity: String(query.filterIdentity ?? 'all'),
    });
    const column = (await this.repository.all())
      .filter((task) => task.status === status)
      .sort(byPosition);
    const items = column.slice(offset, offset + PAGE_SIZE).map(copyTask);
    return {
      items,
      totalCount: column.length,
      pageInfo: this.pageInfo(
        userId,
        status,
        offset,
        items.length,
        column.length,
      ),
    };
  }

  async get(taskId: string): Promise<Task> {
    return copyTask(await this.findTask(taskId));
  }

  async create(userId: string, input: Record<string, unknown>): Promise<Task> {
    const idempotencyKey = requiredString(
      input.idempotencyKey,
      'idempotencyKey',
    );
    const draft = taskDraftFrom(input.task);
    const fingerprint = JSON.stringify(draft);
    const replayKey = `${userId}:${idempotencyKey}`;
    const replay = await this.repository.findCreateReplay(replayKey);
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        throw new ApplicationError(
          409,
          'Idempotency key was reused with different content',
        );
      return this.get(replay.taskId);
    }
    const task: Task = {
      ...draft,
      id: this.taskIds.next(),
      key: await this.repository.nextKey(),
      position: (await this.column(draft.status)).length,
    };
    await this.repository.add(task);
    await this.repository.saveCreateReplay(replayKey, {
      fingerprint,
      taskId: task.id,
    });
    await this.repository.flush();
    return copyTask(task);
  }

  async replace(taskId: string, input: unknown): Promise<Task> {
    const task = await this.findTask(taskId);
    const draft = taskDraftFrom(input);
    const previousStatus = task.status;
    Object.assign(task, draft);
    if (previousStatus !== task.status) {
      await this.normalize(previousStatus);
      task.position = (await this.column(task.status)).length - 1;
      await this.normalize(task.status);
    }
    await this.repository.flush();
    return copyTask(task);
  }

  async remove(taskId: string): Promise<void> {
    const task = await this.findTask(taskId);
    await this.repository.remove(task.id);
    await this.normalize(task.status);
    await this.repository.flush();
  }

  async move(
    taskId: string,
    input: Record<string, unknown>,
  ): Promise<MoveTaskResult> {
    return moveTask(this, taskId, input);
  }

  pageInfo(
    userId: string,
    status: TaskStatus,
    offset: number,
    size: number,
    total: number,
  ): PageInfo {
    const pageInfo: PageInfo = {};
    if (offset + size < total)
      pageInfo.nextToken = this.cursorCodec.encode({
        userId,
        status,
        filterIdentity: 'all',
        offset: offset + PAGE_SIZE,
      });
    if (offset > 0)
      pageInfo.previousToken = this.cursorCodec.encode({
        userId,
        status,
        filterIdentity: 'all',
        offset: Math.max(0, offset - PAGE_SIZE),
      });
    return pageInfo;
  }

  async findTask(taskId: string): Promise<Task> {
    const task = await this.repository.find(taskId);
    if (!task) throw new ApplicationError(404, 'Task was not found');
    return task;
  }

  async column(status: TaskStatus): Promise<Task[]> {
    return (await this.repository.all())
      .filter((task) => task.status === status)
      .sort(byPosition);
  }

  allTasks(): Promise<Task[]> {
    return this.repository.all();
  }

  async normalize(status: TaskStatus): Promise<void> {
    this.applyPositions(await this.column(status));
  }

  applyPositions(tasks: Task[]): void {
    tasks.forEach((task, position) => {
      task.position = position;
    });
  }

  flush(): Promise<void> {
    return this.repository.flush();
  }
}

function byPosition(left: Task, right: Task): number {
  return left.position - right.position;
}
function byStatusThenPosition(left: Task, right: Task): number {
  return (
    TASK_STATUSES.indexOf(left.status) - TASK_STATUSES.indexOf(right.status) ||
    byPosition(left, right)
  );
}
function copyTask(task: Task): Task {
  return { ...task, labels: [...task.labels] };
}

function moveTask(
  service: TaskService,
  taskId: string,
  input: Record<string, unknown>,
): Promise<MoveTaskResult> {
  return moveTaskWithValidatedInput(service, taskId, input);
}

async function moveTaskWithValidatedInput(
  service: TaskService,
  taskId: string,
  input: Record<string, unknown>,
): Promise<MoveTaskResult> {
  const { targetStatus, beforeTaskId } = await validatedMoveInput(
    service,
    taskId,
    input,
  );
  const task = await service.findTask(taskId);
  const allTasks = await service.allTasks();
  const locations = taskLocations(allTasks);
  const targetColumn = (await service.column(targetStatus)).filter(
    (candidate) => candidate.id !== task.id,
  );
  insertTask(targetColumn, task, beforeTaskId);
  const previousStatus = task.status;
  task.status = targetStatus;
  await normalizeMoveColumns(
    service,
    previousStatus,
    targetStatus,
    targetColumn,
  );
  await service.flush();
  return {
    task: copyTask(task),
    previousStatus,
    affectedTasks: changedTasks(await service.allTasks(), locations),
  };
}

async function validatedMoveInput(
  service: TaskService,
  taskId: string,
  input: Record<string, unknown>,
): Promise<{ targetStatus: TaskStatus; beforeTaskId: string | null }> {
  if (input.taskId !== taskId)
    throw new ApplicationError(400, 'taskId must match the path');
  if (
    !Object.hasOwn(input, 'beforeTaskId') ||
    (input.beforeTaskId !== null && typeof input.beforeTaskId !== 'string')
  )
    throw new ApplicationError(400, 'beforeTaskId must be a string or null');
  return {
    targetStatus: taskStatusFrom(input.targetStatus),
    beforeTaskId: input.beforeTaskId as string | null,
  };
}

function taskLocations(tasks: Task[]): Map<string, string> {
  return new Map(
    tasks.map((task) => [task.id, `${task.status}:${task.position}`]),
  );
}

function insertTask(
  targetColumn: Task[],
  task: Task,
  beforeTaskId: string | null,
): void {
  if (!beforeTaskId) return void targetColumn.push(task);
  const anchorIndex = targetColumn.findIndex(
    (candidate) => candidate.id === beforeTaskId,
  );
  if (anchorIndex < 0)
    throw new ApplicationError(
      404,
      'Move anchor was not found in the target status',
    );
  targetColumn.splice(anchorIndex, 0, task);
}

async function normalizeMoveColumns(
  service: TaskService,
  previousStatus: TaskStatus,
  targetStatus: TaskStatus,
  targetColumn: Task[],
): Promise<void> {
  await service.normalize(previousStatus);
  if (previousStatus === targetStatus)
    return service.applyPositions(targetColumn);
  await service.normalize(targetStatus);
}

function changedTasks(
  tasks: Task[],
  previousLocations: Map<string, string>,
): Task[] {
  return tasks
    .filter(
      (task) =>
        previousLocations.get(task.id) !== `${task.status}:${task.position}`,
    )
    .sort(byStatusThenPosition)
    .map(copyTask);
}
