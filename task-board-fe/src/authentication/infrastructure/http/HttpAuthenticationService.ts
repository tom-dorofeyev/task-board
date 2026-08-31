import {
  AuthenticationServiceError,
  ForbiddenError,
  InvalidCredentialsError,
  MalformedAuthenticationResponseError,
  UnauthorizedError,
} from '../../application/AuthenticationErrors'
import type {
  AuthenticatedUser,
  AuthenticationService,
  Credentials,
  Session,
} from '../../application/ports/AuthenticationService'
import type { HttpResponse } from '../../../shared/infrastructure/http/HttpClient'
import {
  isUnauthorizedRequestResult,
  type HttpRequestResult,
} from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'
import type { AuthenticationHttpRequestPort } from './AuthenticationHttpRequestPort'

export class HttpAuthenticationService implements AuthenticationService {
  private readonly requests: AuthenticationHttpRequestPort

  constructor(requests: AuthenticationHttpRequestPort) {
    this.requests = requests
  }

  async getSession(): Promise<Session> {
    const result = await this.get('/auth/session')
    if (isUnauthorizedRequestResult(result)) return { kind: 'anonymous' }
    return { kind: 'authenticated', user: authenticatedUser(result) }
  }

  async login(credentials: Credentials): Promise<AuthenticatedUser> {
    const result = await this.post('/auth/login', credentials)
    if (isUnauthorizedRequestResult(result)) throw new InvalidCredentialsError()
    return authenticatedUser(result)
  }

  async logout(): Promise<void> {
    const result = await this.post('/auth/logout')
    if (isUnauthorizedRequestResult(result)) throw new UnauthorizedError()
    if (result.status === 204) return
    throw responseError(result.status)
  }

  private async get(path: string): Promise<HttpRequestResult> {
    try {
      return await this.requests.get(path, {
        notifyUnauthorized: false,
      })
    } catch (cause) {
      throw new AuthenticationServiceError({ cause })
    }
  }

  private async post(path: string, body?: unknown): Promise<HttpRequestResult> {
    try {
      return await this.requests.post(path, body, {
        notifyUnauthorized: false,
      })
    } catch (cause) {
      throw new AuthenticationServiceError({ cause })
    }
  }
}

function authenticatedUser(response: HttpResponse): AuthenticatedUser {
  if (response.status === 401) throw new UnauthorizedError()
  if (response.status === 403) throw new ForbiddenError()
  if (response.status !== 200) throw new AuthenticationServiceError()
  return parseAuthenticatedUser(response.body)
}

function responseError(status: number): Error {
  if (status === 401) return new UnauthorizedError()
  if (status === 403) return new ForbiddenError()
  return new AuthenticationServiceError()
}

function parseAuthenticatedUser(payload: unknown): AuthenticatedUser {
  if (!isUserResponse(payload)) throw new MalformedAuthenticationResponseError()
  return payload.user
}

function isUserResponse(
  payload: unknown,
): payload is { readonly user: AuthenticatedUser } {
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) {
    return false
  }
  return isAuthenticatedUser(payload.user)
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'username' in value &&
    typeof value.username === 'string' &&
    'displayName' in value &&
    typeof value.displayName === 'string'
  )
}
