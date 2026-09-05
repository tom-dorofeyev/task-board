import {
  TaskBoardApiClient,
  TaskBoardApiError,
} from './task-board-api.client.js';

describe('TaskBoardApiClient', () => {
  it('encodes task IDs when mapping a task read to HTTP', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'a/b' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new TaskBoardApiClient(
      'https://task-board.example/',
      'task_board_session=secret',
      fetcher,
    );
    await client.getTask('a/b');
    expect(fetcher.mock.calls[0][0].toString()).toBe(
      'https://task-board.example/tasks/a%2Fb',
    );
  });

  it('translates an unauthorized API response into a safe tool error', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Authentication is required' }), {
        status: 401,
      }),
    );
    const client = new TaskBoardApiClient(
      'https://task-board.example/',
      undefined,
      fetcher,
    );
    await expect(client.whoami()).rejects.toMatchObject<TaskBoardApiError>({
      status: 401,
      code: 'authentication_required',
      message: 'Authentication is required',
    });
  });

  it('maps a task deletion to an encoded DELETE request', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = new TaskBoardApiClient(
      'https://task-board.example/',
      undefined,
      fetcher,
    );

    await client.deleteTask('a/b');

    expect(fetcher.mock.calls[0][0].toString()).toBe(
      'https://task-board.example/tasks/a%2Fb',
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
