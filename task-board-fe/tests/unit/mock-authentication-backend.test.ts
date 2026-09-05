import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MockAuthenticationBackend } from '../../src/authentication/infrastructure/mock/MockAuthenticationBackend'
import type { HttpResponse } from '../../src/shared/infrastructure/http/HttpClient'

const VALID_CREDENTIALS = { username: 'demo', password: 'correct-password' }
const USER = { id: 'demo-user', username: 'demo', displayName: 'Demo User' }
const SESSION_COOKIE_PATTERN =
  /^task_board_session=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_COOKIE_ATTRIBUTES = 'HttpOnly; Secure; Path=/; SameSite=Lax'
const EXPIRED_SESSION_COOKIE_ATTRIBUTES =
  'HttpOnly; Secure; Max-Age=0; Path=/; SameSite=Lax'

describe('MockAuthenticationBackend', () => {
  it('creates a session cookie and returns the authenticated user for valid credentials', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/login',
      body: VALID_CREDENTIALS,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { user: USER })
    assertSessionCookie(response)
  })

  it('creates distinct opaque session IDs', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })

    const firstSession = await createSession(backend)
    const secondSession = await createSession(backend)

    assert.notEqual(firstSession, secondSession)
  })

  it('accepts the default password when no backend options are supplied', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/login',
      body: { username: 'demo', password: 'demo-password' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { user: USER })
  })

  it('rejects invalid credentials', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/login',
      body: { ...VALID_CREDENTIALS, password: 'incorrect-password' },
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'invalid_credentials' },
    })
  })

  it('rejects a correct password paired with a different username', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/login',
      body: { ...VALID_CREDENTIALS, username: 'other-user' },
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'invalid_credentials' },
    })
  })

  it('rejects malformed login bodies', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })

    for (const body of [
      undefined,
      null,
      {},
      { username: 'demo' },
      { password: VALID_CREDENTIALS.password },
      { username: 1, password: VALID_CREDENTIALS.password },
      { username: 'demo', password: 1 },
    ]) {
      const response = await backend.handle({
        method: 'POST',
        path: '/auth/login',
        body,
      })

      assert.deepEqual(response, {
        status: 401,
        headers: {},
        body: { error: 'invalid_credentials' },
      })
    }
  })

  it('returns the active session', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })
    const session = await createSession(backend)

    const response = await backend.handle({
      method: 'GET',
      path: '/auth/session',
      headers: { cookie: session },
    })

    assert.deepEqual(response, {
      status: 200,
      headers: {},
      body: { user: USER },
    })
  })

  it('returns unauthorized for a session request without a session', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({
      method: 'GET',
      path: '/auth/session',
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('invalidates the active session cookie on logout', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })
    const session = await createSession(backend)

    await backend.handle({
      method: 'POST',
      path: '/auth/logout',
      headers: { cookie: session },
    })

    const response = await backend.handle({
      method: 'GET',
      path: '/auth/session',
      headers: { cookie: session },
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('rejects logout without an active session', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/logout',
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('rejects logout with an unknown session cookie', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/logout',
      headers: { cookie: 'task_board_session=unknown-session' },
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('accepts its session cookie among other cookies', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })
    const session = await createSession(backend)

    const response = await backend.handle({
      method: 'GET',
      path: '/auth/session',
      headers: { cookie: `theme=dark; ${session}; locale=en` },
    })

    assert.deepEqual(response, {
      status: 200,
      headers: {},
      body: { user: USER },
    })
  })

  it('treats an unrelated cookie header as an unauthenticated session', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({
      method: 'GET',
      path: '/auth/session',
      headers: { cookie: 'theme=dark' },
    })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('expires the session cookie with secure attributes on logout', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })
    const session = await createSession(backend)

    const response = await backend.handle({
      method: 'POST',
      path: '/auth/logout',
      headers: { cookie: session },
    })

    assertExpiredSessionCookie(response)
  })

  it('returns unauthorized for protected task access without a session', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({ method: 'GET', path: '/tasks' })

    assert.deepEqual(response, {
      status: 401,
      headers: {},
      body: { error: 'unauthorized' },
    })
  })

  it('returns protected tasks for an active session', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
    })
    const session = await createSession(backend)

    const response = await backend.handle({
      method: 'GET',
      path: '/tasks',
      headers: { cookie: session },
    })

    assert.deepEqual(response, {
      status: 200,
      headers: {},
      body: { items: [] },
    })
  })

  it('allows an active session to access tasks by default', async () => {
    const backend = new MockAuthenticationBackend()
    const session = await createDefaultSession(backend)

    const response = await backend.handle({
      method: 'GET',
      path: '/tasks',
      headers: { cookie: session },
    })

    assert.deepEqual(response, {
      status: 200,
      headers: {},
      body: { items: [] },
    })
  })

  it('returns forbidden for a session without task access', async () => {
    const backend = new MockAuthenticationBackend({
      password: VALID_CREDENTIALS.password,
      taskAccess: 'forbidden',
    })
    const session = await createSession(backend)

    const response = await backend.handle({
      method: 'GET',
      path: '/tasks',
      headers: { cookie: session },
    })

    assert.deepEqual(response, {
      status: 403,
      headers: {},
      body: { error: 'forbidden' },
    })
  })

  it('returns not found for unsupported requests through the HttpClient contract', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.execute({ method: 'POST', path: '/unknown' })

    assert.deepEqual(response, {
      status: 404,
      headers: {},
      body: { error: 'not_found' },
    })
  })

  it('returns method not allowed with accepted methods for known routes', async () => {
    const backend = new MockAuthenticationBackend()
    const session = await createDefaultSession(backend)

    for (const request of [
      { method: 'POST' as const, path: '/auth/session' },
      { method: 'GET' as const, path: '/auth/login' },
      { method: 'GET' as const, path: '/auth/logout' },
      { method: 'POST' as const, path: '/tasks', headers: { cookie: session } },
    ]) {
      const response = await backend.handle(request)

      assert.deepEqual(response, {
        status: 405,
        headers: {
          allow:
            request.path === '/auth/session' || request.path === '/tasks'
              ? 'GET'
              : 'POST',
        },
        body: { error: 'method_not_allowed' },
      })
    }
  })

  it('returns the accepted methods for task detail and move routes', async () => {
    const backend = new MockAuthenticationBackend()
    const session = await createDefaultSession(backend)

    const taskResponse = await backend.handle({
      method: 'POST',
      path: '/tasks/task-1',
      headers: { cookie: session },
    })
    const moveResponse = await backend.handle({
      method: 'PUT',
      path: '/tasks/task-1/move',
      headers: { cookie: session },
    })

    assert.equal(taskResponse.headers.allow, 'GET, PUT, DELETE')
    assert.equal(moveResponse.headers.allow, 'POST')
  })

  it('returns not found for unknown paths regardless of HTTP method', async () => {
    const backend = new MockAuthenticationBackend()

    const response = await backend.handle({ method: 'GET', path: '/unknown' })

    assert.deepEqual(response, {
      status: 404,
      headers: {},
      body: { error: 'not_found' },
    })
  })
})

async function createSession(
  backend: MockAuthenticationBackend,
): Promise<string> {
  const response = await backend.handle({
    method: 'POST',
    path: '/auth/login',
    body: VALID_CREDENTIALS,
  })
  return sessionCookie(response)
}

async function createDefaultSession(
  backend: MockAuthenticationBackend,
): Promise<string> {
  const response = await backend.handle({
    method: 'POST',
    path: '/auth/login',
    body: { username: 'demo', password: 'demo-password' },
  })
  return sessionCookie(response)
}

function sessionCookie(response: HttpResponse): string {
  const setCookie = response.headers['set-cookie']
  assert.notEqual(setCookie, undefined)
  return setCookie.split(';')[0]
}

function assertSessionCookie(response: HttpResponse): void {
  const setCookie = response.headers['set-cookie']
  assert.notEqual(setCookie, undefined)
  const [sessionCookie, ...attributes] = setCookie.split('; ')
  assert.match(sessionCookie, SESSION_COOKIE_PATTERN)
  assert.equal(attributes.join('; '), SESSION_COOKIE_ATTRIBUTES)
}

function assertExpiredSessionCookie(response: HttpResponse): void {
  const setCookie = response.headers['set-cookie']
  assert.notEqual(setCookie, undefined)
  const [sessionCookie, ...attributes] = setCookie.split('; ')
  assert.equal(sessionCookie, 'task_board_session=')
  assert.equal(attributes.join('; '), EXPIRED_SESSION_COOKIE_ATTRIBUTES)
}
