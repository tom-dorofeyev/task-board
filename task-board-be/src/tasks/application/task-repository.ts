import type { Task } from '../domain/task.js';

export const TASK_REPOSITORY = Symbol('TaskRepository');

export interface CreateReplay {
  fingerprint: string;
  taskId: string;
}

export interface TaskRepository {
  all(): Task[];
  find(taskId: string): Task | undefined;
  add(task: Task): void;
  nextKey(): string;
  findCreateReplay(key: string): CreateReplay | undefined;
  saveCreateReplay(key: string, replay: CreateReplay): void;
}
