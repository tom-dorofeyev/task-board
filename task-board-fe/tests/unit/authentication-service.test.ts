import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AuthenticationServiceError,
  ForbiddenError,
  InvalidCredentialsError,
  MalformedAuthenticationResponseError,
  UnauthorizedError,
} from '../../src/authentication/application/AuthenticationErrors'
import { HttpAuthenticationService } from '../../src/authentication/infrastructure/http/HttpAuthenticationService'
import type { HttpResponse } from '../../src/shared/infrastructure/http/HttpClient'
import type { HttpRequestResult } from '../../src/shared/infrastructure/http/CookieHttpRequestBoundary'
import type { AuthenticationHttpRequestPort } from '../../src/authentication/infrastructure/http/AuthenticationHttpRequestPort'

const USER = { id: 'user-1', username: 'demo', displayName: 'Demo User' }
const VALID_CREDENTIALS = { username: 'demo', password: 'correct-password' }

describe('HttpAuthenticationService', () => {
  it('maps an unauthenticated session response to an anonymous session', async () => {
    const client = responseClient(401)
    const service = new HttpAuthenticationService(client)

    const session = await service.getSession()

    assert.deepEqual(session, { kind: 'anonymous' })
    assert.deepEqual(client.requests, [
      { method: 'GET', path: '/auth/session' },
    ])
  })

  it('maps a valid session payload to an authenticated session', async () => {
    const client = responseClient(200, { user: USER })
    const service = new HttpAuthenticationService(client)

    assert.deepEqual(await service.getSession(), {
      kind: 'authenticated',
      user: USER,
    })
    assert.deepEqual(client.requests, [
      { method: 'GET', path: '/auth/session' },
    ])
  })

  it('maps valid login payloads to an authenticated user', async () => {
    const client = responseClient(200, { user: USER })
    const service = new HttpAuthenticationService(client)

    const user = await service.login(VALID_CREDENTIALS)

    assert.deepEqual(user, USER)
    assert.deepEqual(client.requests, [
      { method: 'POST', path: '/auth/login', body: VALID_CREDENTIALS },
    ])
  })

  it('maps forbidden session responses to a forbidden error', async () => {
    const service = new HttpAuthenticationService(responseClient(403))

    await assert.rejects(service.getSession(), ForbiddenError)
  })

  it('maps other session responses to a service error', async () => {
    const service = new HttpAuthenticationService(responseClient(500))

    await assert.rejects(
      service.getSession(),
      (error: unknown) =>
        error instanceof AuthenticationServiceError &&
        error.message === 'Authentication request failed.' &&
        !('status' in error),
    )
  })

  it('maps rejected session transports to a service error preserving the cause', async () => {
    const transportError = new Error('Network unavailable')
    const service = new HttpAuthenticationService(
      rejectedClient(transportError),
    )

    await assert.rejects(
      service.getSession(),
      (error: unknown) =>
        error instanceof AuthenticationServiceError &&
        error.cause === transportError,
    )
  })

  it('maps rejected login transports to a service error preserving the cause', async () => {
    const transportError = new Error('Network unavailable')
    const service = new HttpAuthenticationService(
      rejectedClient(transportError),
    )

    await assert.rejects(
      service.login(VALID_CREDENTIALS),
      (error: unknown) =>
        error instanceof AuthenticationServiceError &&
        error.cause === transportError,
    )
  })

  it('rejects malformed successful session payloads', async () => {
    const service = new HttpAuthenticationService(
      responseClient(200, { user: {} }),
    )

    await assert.rejects(
      service.getSession(),
      (error: unknown) =>
        error instanceof MalformedAuthenticationResponseError &&
        error.message ===
          'Authentication service returned an invalid authenticated-user response.',
    )
  })

  it('rejects missing and invalid authenticated-user fields in session payloads', async () => {
    for (const body of [
      null,
      'not an object',
      {},
      { user: null },
      { user: 'not an object' },
      { user: { id: 1, username: 'demo', displayName: 'Demo User' } },
      { user: { id: 'user-1', username: 1, displayName: 'Demo User' } },
      { user: { id: 'user-1', username: 'demo', displayName: 1 } },
    ]) {
      const service = new HttpAuthenticationService(responseClient(200, body))

      await assert.rejects(
        service.getSession(),
        MalformedAuthenticationResponseError,
      )
    }
  })

  it('maps rejected login credentials to an invalid credentials error', async () => {
    const service = new HttpAuthenticationService(responseClient(401))

    await assert.rejects(
      service.login({ username: 'demo', password: 'incorrect-password' }),
      InvalidCredentialsError,
    )
  })

  it('maps forbidden login responses to a forbidden error', async () => {
    const service = new HttpAuthenticationService(responseClient(403))

    await assert.rejects(service.login(VALID_CREDENTIALS), ForbiddenError)
  })

  it('maps other login responses to a service error', async () => {
    const service = new HttpAuthenticationService(responseClient(500))

    await assert.rejects(
      service.login(VALID_CREDENTIALS),
      AuthenticationServiceError,
    )
  })

  it('rejects malformed successful login payloads', async () => {
    const service = new HttpAuthenticationService(
      responseClient(200, { user: {} }),
    )

    await assert.rejects(
      service.login(VALID_CREDENTIALS),
      MalformedAuthenticationResponseError,
    )
  })

  it('maps forbidden logout responses to a forbidden error', async () => {
    const client = responseClient(403)
    const service = new HttpAuthenticationService(client)

    await assert.rejects(service.logout(), ForbiddenError)

    assert.deepEqual(client.requests, [
      { method: 'POST', path: '/auth/logout' },
    ])
  })

  it('completes logout after a no-content response', async () => {
    const client = responseClient(204)
    const service = new HttpAuthenticationService(client)

    await service.logout()

    assert.deepEqual(client.requests, [
      { method: 'POST', path: '/auth/logout' },
    ])
  })

  it('maps unauthorized logout responses to an unauthorized error', async () => {
    const service = new HttpAuthenticationService(responseClient(401))

    await assert.rejects(service.logout(), UnauthorizedError)
  })

  it('maps other logout responses to a service error', async () => {
    const service = new HttpAuthenticationService(responseClient(500))

    await assert.rejects(
      service.logout(),
      (error: unknown) =>
        error instanceof AuthenticationServiceError &&
        error.message === 'Authentication request failed.' &&
        !('status' in error),
    )
  })

  it('sends every authentication request without global unauthorized notification', async () => {
    const client = new OptionRecordingClient()
    const service = new HttpAuthenticationService(client)

    await service.getSession()
    await service.login(VALID_CREDENTIALS)
    await service.logout()

    assert.deepEqual(client.options, [
      { notifyUnauthorized: false },
      { notifyUnauthorized: false },
      { notifyUnauthorized: false },
    ])
  })

  it('handles raw unauthorized responses defensively at the authentication port', async () => {
    await assert.rejects(
      new HttpAuthenticationService(rawResponseClient(401)).getSession(),
      UnauthorizedError,
    )
    await assert.rejects(
      new HttpAuthenticationService(rawResponseClient(401)).login(
        VALID_CREDENTIALS,
      ),
      UnauthorizedError,
    )
    await assert.rejects(
      new HttpAuthenticationService(rawResponseClient(401)).logout(),
      UnauthorizedError,
    )
  })
})

function responseClient(status: number, body?: unknown): FixedResponseClient {
  return new FixedResponseClient({ status, headers: {}, body })
}

function rejectedClient(error: Error): AuthenticationHttpRequestPort {
  return {
    get: async () => Promise.reject(error),
    post: async () => Promise.reject(error),
  }
}

function rawResponseClient(status: number): AuthenticationHttpRequestPort {
  return {
    get: async () => ({ status, headers: {} }),
    post: async () => ({ status, headers: {} }),
  }
}

class OptionRecordingClient implements AuthenticationHttpRequestPort {
  readonly options: Array<{ notifyUnauthorized?: boolean } | undefined> = []
  private postCount = 0

  async get(
    _path: string,
    options?: { notifyUnauthorized?: boolean },
  ): Promise<HttpRequestResult> {
    this.options.push(options)
    return { status: 200, headers: {}, body: { user: USER } }
  }

  async post(
    _path: string,
    _body?: unknown,
    options?: { notifyUnauthorized?: boolean },
  ): Promise<HttpRequestResult> {
    this.options.push(options)
    this.postCount += 1
    if (this.postCount === 1) {
      return { status: 200, headers: {}, body: { user: USER } }
    }
    return { status: 204, headers: {} }
  }
}

class FixedResponseClient implements AuthenticationHttpRequestPort {
  private readonly response: HttpResponse
  readonly requests: Array<{ method: string; path: string; body?: unknown }> =
    []

  constructor(response: HttpResponse) {
    this.response = response
  }

  async get(path: string): Promise<HttpRequestResult> {
    return this.request('GET', path)
  }

  async post(path: string, body?: unknown): Promise<HttpRequestResult> {
    return this.request('POST', path, body)
  }

  private request(
    method: string,
    path: string,
    body?: unknown,
  ): HttpRequestResult {
    this.requests.push({
      method,
      path,
      ...(body === undefined ? {} : { body }),
    })
    if (this.response.status === 401) return { kind: 'unauthorized' }
    return this.response
  }
}
