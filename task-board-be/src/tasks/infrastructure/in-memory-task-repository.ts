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

  async all(): Promise<Task[]> {
    return this.tasks;
  }

  async find(taskId: string): Promise<Task | undefined> {
    return this.tasks.find((task) => task.id === taskId);
  }

  async add(task: Task): Promise<void> {
    this.tasks.push(task);
  }

  async remove(taskId: string): Promise<void> {
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) this.tasks.splice(index, 1);
  }

  async nextKey(): Promise<string> {
    return `NEX-${this.nextTaskNumber++}`;
  }

  async findCreateReplay(key: string): Promise<CreateReplay | undefined> {
    return this.createReplays.get(key);
  }

  async saveCreateReplay(key: string, replay: CreateReplay): Promise<void> {
    this.createReplays.set(key, replay);
  }

  async flush(): Promise<void> {}
}
