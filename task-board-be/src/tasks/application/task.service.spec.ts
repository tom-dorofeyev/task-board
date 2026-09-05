import { TaskService } from './task.service.js';
import { HmacTaskCursorCodec } from '../infrastructure/hmac-task-cursor-codec.js';
import { InMemoryTaskRepository } from '../infrastructure/in-memory-task-repository.js';
import { RandomTaskIdGenerator } from '../infrastructure/random-task-id-generator.js';

const TASK = {
  title: 'Task title',
  description: 'Task description',
  status: 'todo',
  priority: 'medium',
  assignee: 'Jordan Lee',
  labels: ['release'],
};

describe('TaskService', () => {
  it('returns the original task for an idempotent replay', async () => {
    const service = taskService();
    const first = await service.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    const replay = await service.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    expect(replay).toEqual(first);
  });

  it('repairs positions after a cross-column replacement', async () => {
    const service = taskService();
    const first = await service.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    const second = await service.create('user-1', {
      idempotencyKey: 'create-2',
      task: { ...TASK, title: 'Second task' },
    });
    const updated = await service.replace(first.id, {
      ...TASK,
      status: 'done',
    });
    expect(updated).toMatchObject({ status: 'done', position: 0 });
    await expect(service.get(second.id)).resolves.toMatchObject({
      status: 'todo',
      position: 0,
    });
  });

  it('returns changed rows when a task moves before an anchor', async () => {
    const service = taskService();
    const first = await service.create('user-1', {
      idempotencyKey: 'create-1',
      task: TASK,
    });
    const second = await service.create('user-1', {
      idempotencyKey: 'create-2',
      task: { ...TASK, title: 'Second task' },
    });
    const move = await service.move(second.id, {
      taskId: second.id,
      targetStatus: 'todo',
      beforeTaskId: first.id,
    });
    expect(move.affectedTasks.map((task) => task.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('rejects a cursor from another user', async () => {
    const service = taskService();
    for (let position = 0; position <= 50; position += 1)
      await service.create('user-1', {
        idempotencyKey: `create-${position}`,
        task: { ...TASK, title: `Task ${position}` },
      });
    const firstPage = await service.list('user-1', { status: 'todo' });
    await expect(
      service.list('user-2', {
        status: 'todo',
        continuationToken: firstPage.pageInfo.nextToken,
      }),
    ).rejects.toThrow('Invalid continuation token');
  });
});

function taskService(): TaskService {
  return new TaskService(
    new InMemoryTaskRepository(),
    new HmacTaskCursorCodec(),
    new RandomTaskIdGenerator(),
  );
}
