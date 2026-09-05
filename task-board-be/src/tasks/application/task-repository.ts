import type { Task } from '../domain/task.js';

export const TASK_REPOSITORY = Symbol('TaskRepository');

export interface CreateReplay {
  fingerprint: string;
  taskId: string;
}

export interface TaskRepository {
  all(): Promise<Task[]>;
  find(taskId: string): Promise<Task | undefined>;
  add(task: Task): Promise<void>;
  remove(taskId: string): Promise<void>;
  nextKey(): Promise<string>;
  findCreateReplay(key: string): Promise<CreateReplay | undefined>;
  saveCreateReplay(key: string, replay: CreateReplay): Promise<void>;
  flush(): Promise<void>;
}
