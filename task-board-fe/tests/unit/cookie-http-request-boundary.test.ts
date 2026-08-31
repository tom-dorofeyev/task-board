import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MockAuthenticationBackend } from '../../src/authentication/infrastructure/mock/MockAuthenticationBackend'
import {
  CookieHttpRequestBoundary,
  isUnauthorizedRequestResult,
} from '../../src/shared/infrastructure/http/CookieHttpRequestBoundary'
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/shared/infrastructure/http/HttpClient'
import { HttpService } from '../../src/shared/infrastructure/http/HttpService'
import type { UnauthorizedSessionInvalidator } from '../../src/shared/infrastructure/http/UnauthorizedSessionInvalidator'

describe('CookieHttpRequestBoundary', () => {
  it('returns the same unauthorized result for auth and task requests', async () => {
    const boundary = requestBoundary(new MockAuthenticationBackend())

    const [authResult, taskResult] = await Promise.all([
      boundary.execute({ method: 'GET', path: '/auth/session' }),
      boundary.execute({ method: 'GET', path: '/tasks' }),
    ])

    assert.equal(isUnauthorizedRequestResult(authResult), true)
    assert.equal(isUnauthorizedRequestResult(taskResult), true)
  })

  it('leaves forbidden responses visible without invalidating the session', async () => {
    const invalidator = new RecordingInvalidator()
    const backend = new MockAuthenticationBackend({ taskAccess: 'forbidden' })
    const boundary = requestBoundary(backend, invalidator)

    const result = await boundary.execute({
      method: 'GET',
      path: '/tasks',
      headers: { cookie: await sessionCookie(backend) },
    })

    assert.deepEqual(result, {
      status: 403,
      headers: {},
      body: { error: 'forbidden' },
    })
    assert.equal(invalidator.invalidationCount, 0)
  })

  it('executes requests with cookie credentials included', async () => {
    const client = responseClient(200)
    const boundary = requestBoundary(client)

    await boundary.execute({ method: 'GET', path: '/tasks' })

    assert.equal(client.request?.credentials, 'include')
  })

  it('converts every convenience method to the matching credentialed HTTP request', async () => {
    const client = responseClient(200)
    const boundary = requestBoundary(client)

    await boundary.get('/get')
    assert.deepEqual(client.request, {
      method: 'GET',
      path: '/get',
      credentials: 'include',
      headers: undefined,
    })
    await boundary.post('/post', { value: 'post' })
    assert.deepEqual(client.request, {
      method: 'POST',
      path: '/post',
      body: { value: 'post' },
      credentials: 'include',
      headers: undefined,
    })
    await boundary.put('/put', { value: 'put' })
    assert.deepEqual(client.request, {
      method: 'PUT',
      path: '/put',
      body: { value: 'put' },
      credentials: 'include',
      headers: undefined,
    })
    await boundary.delete('/delete')
    assert.deepEqual(client.request, {
      method: 'DELETE',
      path: '/delete',
      credentials: 'include',
      headers: undefined,
    })
  })

  it('can suppress unauthorized invalidation for a request', async () => {
    const invalidator = new RecordingInvalidator()
    const boundary = requestBoundary(responseClient(401), invalidator)

    const result = await boundary.execute(
      { method: 'GET', path: '/auth/session' },
      { notifyUnauthorized: false },
    )

    assert.equal(isUnauthorizedRequestResult(result), true)
    assert.equal(invalidator.invalidationCount, 0)
  })

  it('identifies only the explicit unauthorized result', () => {
    assert.equal(
      isUnauthorizedRequestResult({ status: 200, headers: {} }),
      false,
    )
    assert.equal(isUnauthorizedRequestResult({ kind: 'other' } as never), false)
  })

  it('preserves the boundary invalidation error name', async () => {
    const boundary = requestBoundary(
      responseClient(401),
      new RejectingInvalidator(),
    )

    await assert.rejects(
      boundary.execute({ method: 'GET', path: '/tasks' }),
      (error: unknown) =>
        error instanceof Error &&
        error.name === 'UnauthorizedSessionInvalidationError',
    )
  })
})

function requestBoundary(
  client: HttpClient,
  invalidator: UnauthorizedSessionInvalidator = new RecordingInvalidator(),
): CookieHttpRequestBoundary {
  return new CookieHttpRequestBoundary(new HttpService(client), invalidator)
}

function responseClient(status: number): FixedResponseClient {
  return new FixedResponseClient({ status, headers: {} })
}

async function sessionCookie(
  backend: MockAuthenticationBackend,
): Promise<string> {
  const response = await backend.execute({
    method: 'POST',
    path: '/auth/login',
    body: { username: 'demo', password: 'demo-password' },
  })
  const setCookie = response.headers['set-cookie']
  assert.notEqual(setCookie, undefined)
  return setCookie.split(';')[0]
}

class RecordingInvalidator implements UnauthorizedSessionInvalidator {
  invalidationCount = 0

  async invalidateUnauthorizedSession(): Promise<void> {
    this.invalidationCount += 1
  }
}

class RejectingInvalidator implements UnauthorizedSessionInvalidator {
  async invalidateUnauthorizedSession(): Promise<void> {
    throw new Error('Cannot invalidate')
  }
}

class FixedResponseClient implements HttpClient {
  request: HttpRequest | undefined

  constructor(private readonly response: HttpResponse) {}

  async execute(request: HttpRequest): Promise<HttpResponse> {
    this.request = request
    return this.response
  }
}
