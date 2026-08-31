import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/shared/infrastructure/http/HttpClient'
import { HttpService } from '../../src/shared/infrastructure/http/HttpService'

describe('HttpService', () => {
  it('forwards GET requests with request options', async () => {
    const client = new RecordingHttpClient()

    await new HttpService(client).get('/tasks', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })

    assert.deepEqual(client.request, {
      method: 'GET',
      path: '/tasks',
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
  })

  it('forwards POST request bodies', async () => {
    const client = new RecordingHttpClient()
    const body = { title: 'Plan migration' }

    await new HttpService(client).post('/tasks', body)

    assert.deepEqual(client.request, { method: 'POST', path: '/tasks', body })
  })

  it('forwards PUT request bodies', async () => {
    const client = new RecordingHttpClient()
    const body = { title: 'Complete migration' }

    await new HttpService(client).put('/tasks/task-1', body)

    assert.deepEqual(client.request, {
      method: 'PUT',
      path: '/tasks/task-1',
      body,
    })
  })

  it('forwards DELETE requests without a body', async () => {
    const client = new RecordingHttpClient()

    await new HttpService(client).delete('/tasks/task-1')

    assert.deepEqual(client.request, {
      method: 'DELETE',
      path: '/tasks/task-1',
    })
  })
})

class RecordingHttpClient implements HttpClient {
  request: HttpRequest | undefined

  async execute(request: HttpRequest): Promise<HttpResponse> {
    this.request = request
    return { status: 204, headers: {} }
  }
}
