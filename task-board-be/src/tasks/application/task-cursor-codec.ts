import type { TaskStatus } from '../domain/task.js';

export const TASK_CURSOR_CODEC = Symbol('TaskCursorCodec');

export interface TaskCursor {
  userId: string;
  status: TaskStatus;
  filterIdentity: string;
  offset: number;
}

export interface TaskCursorCodec {
  encode(cursor: TaskCursor): string;
  offset(token: unknown, expected: Omit<TaskCursor, 'offset'>): number;
}
