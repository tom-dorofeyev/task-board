import type { HttpRequest, HttpResponse } from './HttpClient'
import { HttpService } from './HttpService'
import type { UnauthorizedSessionInvalidator } from './UnauthorizedSessionInvalidator'

export interface UnauthorizedRequestResult {
  readonly kind: 'unauthorized'
}

export type HttpRequestResult = HttpResponse | UnauthorizedRequestResult

export interface HttpRequestOptions {
  readonly notifyUnauthorized?: boolean
}

export interface HttpRequestExecutor {
  execute(
    request: HttpRequest,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult>
}

export interface CookieHttpService {
  get(path: string, options?: HttpRequestOptions): Promise<HttpRequestResult>
  post(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult>
  put(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult>
  delete(path: string, options?: HttpRequestOptions): Promise<HttpRequestResult>
}

export class UnauthorizedSessionInvalidationError extends Error {
  constructor(options?: ErrorOptions) {
    super('Unauthorized session invalidation failed.', options)
    this.name = 'UnauthorizedSessionInvalidationError'
  }
}

const unauthorizedResult: UnauthorizedRequestResult = { kind: 'unauthorized' }

export class CookieHttpRequestBoundary
  implements HttpRequestExecutor, CookieHttpService
{
  private readonly http: HttpService
  private readonly unauthorizedSessions: UnauthorizedSessionInvalidator

  constructor(
    http: HttpService,
    unauthorizedSessions: UnauthorizedSessionInvalidator,
  ) {
    this.http = http
    this.unauthorizedSessions = unauthorizedSessions
  }

  async execute(
    request: HttpRequest,
    options: HttpRequestOptions = {},
  ): Promise<HttpRequestResult> {
    const response = await this.send(request)
    if (response.status !== 401) return response
    if (options.notifyUnauthorized !== false) {
      await this.invalidateUnauthorizedSession()
    }
    return unauthorizedResult
  }

  get(path: string, options?: HttpRequestOptions): Promise<HttpRequestResult> {
    return this.execute({ method: 'GET', path }, options)
  }

  post(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult> {
    return this.execute({ method: 'POST', path, body }, options)
  }

  put(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult> {
    return this.execute({ method: 'PUT', path, body }, options)
  }

  delete(
    path: string,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult> {
    return this.execute({ method: 'DELETE', path }, options)
  }

  private send(request: HttpRequest): Promise<HttpResponse> {
    const options = {
      credentials: 'include' as const,
      headers: request.headers,
    }
    if (request.method === 'GET') return this.http.get(request.path, options)
    if (request.method === 'POST') {
      return this.http.post(request.path, request.body, options)
    }
    if (request.method === 'PUT') {
      return this.http.put(request.path, request.body, options)
    }
    return this.http.delete(request.path, options)
  }

  private async invalidateUnauthorizedSession(): Promise<void> {
    try {
      await this.unauthorizedSessions.invalidateUnauthorizedSession()
    } catch (cause) {
      throw new UnauthorizedSessionInvalidationError({ cause })
    }
  }
}

export function isUnauthorizedRequestResult(
  result: HttpRequestResult,
): result is UnauthorizedRequestResult {
  return 'kind' in result && result.kind === 'unauthorized'
}
