import { Injectable } from '@nestjs/common';
import type {
  CreateReplay,
  TaskRepository,
} from '../application/task-repository.js';
import type { Task } from '../domain/task.js';

@Injectable()
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: Task[] = [];
  private readonly createReplays = new Map<string, CreateReplay>();
  private nextTaskNumber = 1;

  all(): Task[] {
    return this.tasks;
  }

  find(taskId: string): Task | undefined {
    return this.tasks.find((task) => task.id === taskId);
  }

  add(task: Task): void {
    this.tasks.push(task);
  }

  nextKey(): string {
    return `NEX-${this.nextTaskNumber++}`;
  }

  findCreateReplay(key: string): CreateReplay | undefined {
    return this.createReplays.get(key);
  }

  saveCreateReplay(key: string, replay: CreateReplay): void {
    this.createReplays.set(key, replay);
  }
}
