import { describe, expect, it } from 'vitest';
import { TaskService } from '../application/task.service.js';
import { HmacTaskCursorCodec } from './hmac-task-cursor-codec.js';
import {
  MongoTaskRepository,
  type PersistedTaskState,
  type TaskStateStore,
} from './mongo-task-repository.js';
import { RandomTaskIdGenerator } from './random-task-id-generator.js';

const TASK = {
  title: 'Task title',
  description: 'Task description',
  status: 'todo',
  priority: 'medium',
  assignee: 'Jordan Lee',
  labels: ['release'],
};

describe('MongoTaskRepository', () => {
  it('restores task state, idempotency replays, and the next task key', async () => {
    const store = new MemoryTaskStateStore();
    const firstService = await taskService(store);
    const created = await firstService.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    await firstService.replace(created.id, { ...TASK, title: 'Updated task' });

    const secondService = await taskService(store);
    const replay = await secondService.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    const next = await secondService.create('user-1', {
      idempotencyKey: 'create-2',
      task: { ...TASK, title: 'Second task' },
    });

    expect(await secondService.get(created.id)).toMatchObject({
      title: 'Updated task',
      key: 'NEX-1',
    });
    expect(replay).toMatchObject({ id: created.id, key: 'NEX-1' });
    expect(next).toMatchObject({ key: 'NEX-2' });
  });

  it('rejects a create when persistence fails and restores its previous state', async () => {
    const store = new MemoryTaskStateStore();
    const service = await taskService(store);
    store.rejectWrites();

    await expect(
      service.create('user-1', { idempotencyKey: 'create-1', task: TASK }),
    ).rejects.toThrow('Mongo persistence failed');

    store.acceptWrites();
    const created = await service.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    expect(created.key).toBe('NEX-1');
  });
});

class MemoryTaskStateStore implements TaskStateStore {
  private state: PersistedTaskState | undefined;
  private writesFail = false;

  async load(): Promise<PersistedTaskState | undefined> {
    return this.state && structuredClone(this.state);
  }

  async save(state: PersistedTaskState): Promise<void> {
    if (this.writesFail) throw new Error('Mongo persistence failed');
    this.state = structuredClone(state);
  }

  rejectWrites(): void {
    this.writesFail = true;
  }

  acceptWrites(): void {
    this.writesFail = false;
  }
}

async function taskService(store: TaskStateStore): Promise<TaskService> {
  return new TaskService(
    await MongoTaskRepository.fromStore(store),
    new HmacTaskCursorCodec(),
    new RandomTaskIdGenerator(),
  );
}
