import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const TASK_DRAFT = {
  title: 'Prepare release notes',
  description: 'Summarise completed work.',
  status: 'todo',
  priority: 'medium',
  assignee: 'Jordan Lee',
  labels: ['release'],
};

describe('Task Board API', () => {
  let app: INestApplication;
  let sessionCookie: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo', password: 'password' })
      .expect(200);
    sessionCookie = response.headers['set-cookie'][0].split(';')[0];
  });

  afterEach(async () => {
    await app.close();
  });

  it('resolves the active session', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(response.body).toEqual({
      user: { id: 'user-demo', username: 'demo', displayName: 'Demo User' },
    });
  });

  it('creates idempotently and lists a status column in position order', async () => {
    const first = await createTask('release-notes');
    const replay = await createTask('release-notes');
    const page = await request(app.getHttpServer())
      .get('/tasks')
      .query({ status: 'todo', sort: 'board-order', filterIdentity: 'all' })
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(replay.body).toEqual(first.body);
    expect(page.body).toMatchObject({
      totalCount: 1,
      items: [{ id: first.body.id, position: 0 }],
      pageInfo: {},
    });
  });

  it('moves a task before an anchor and returns reconciled rows', async () => {
    const first = await createTask('first');
    const second = await createTask('second');
    const result = await request(app.getHttpServer())
      .post(`/tasks/${second.body.id}/move`)
      .set('Cookie', sessionCookie)
      .send({
        taskId: second.body.id,
        targetStatus: 'todo',
        beforeTaskId: first.body.id,
      })
      .expect(200);
    expect(result.body.task.position).toBe(0);
    expect(
      result.body.affectedTasks.map((task: { id: string }) => task.id),
    ).toEqual([second.body.id, first.body.id]);
  });

  it('deletes a task and repairs the remaining column positions', async () => {
    const first = await createTask('first');
    const second = await createTask('second');

    await request(app.getHttpServer())
      .delete(`/tasks/${first.body.id}`)
      .set('Cookie', sessionCookie)
      .expect(204);

    const page = await request(app.getHttpServer())
      .get('/tasks')
      .query({ status: 'todo' })
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(page.body.items).toEqual([
      expect.objectContaining({ id: second.body.id, position: 0 }),
    ]);
  });

  it('rejects task reads without a session', async () => {
    await request(app.getHttpServer())
      .get('/tasks')
      .query({ status: 'todo' })
      .expect(401);
  });

  it('keeps only login public', async () => {
    await request(app.getHttpServer()).get('/auth/session').expect(401);
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
  });

  it('denies task permissions to an authenticated blocked user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'blocked', password: 'password' })
      .expect(200);
    const blockedSessionCookie =
      response.headers['set-cookie'][0].split(';')[0];

    await request(app.getHttpServer())
      .get('/tasks')
      .query({ status: 'todo' })
      .set('Cookie', blockedSessionCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', blockedSessionCookie)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .get('/tasks/not-a-task')
      .set('Cookie', blockedSessionCookie)
      .expect(403);
    await request(app.getHttpServer())
      .put('/tasks/not-a-task')
      .set('Cookie', blockedSessionCookie)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .delete('/tasks/not-a-task')
      .set('Cookie', blockedSessionCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/tasks/not-a-task/move')
      .set('Cookie', blockedSessionCookie)
      .send({})
      .expect(403);
  });

  async function createTask(idempotencyKey: string) {
    return request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', sessionCookie)
      .send({ idempotencyKey, task: TASK_DRAFT })
      .expect(200);
  }
});
