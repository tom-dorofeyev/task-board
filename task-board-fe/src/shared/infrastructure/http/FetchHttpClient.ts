import type { HttpClient, HttpRequest, HttpResponse } from './HttpClient'

export class FetchHttpClient implements HttpClient {
  async execute(request: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(request.path, requestOptions(request))
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await responseBody(response),
    }
  }
}

function requestOptions(request: HttpRequest): RequestInit {
  return {
    method: request.method,
    credentials: request.credentials,
    headers:
      request.body === undefined ? request.headers : jsonHeaders(request),
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  }
}

function jsonHeaders(request: HttpRequest): Readonly<Record<string, string>> {
  return { 'content-type': 'application/json', ...request.headers }
}

async function responseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  try {
    return await response.json()
  } catch (cause) {
    return authorizationResponseBody(response, cause)
  }
}

function authorizationResponseBody(
  response: Response,
  cause: unknown,
): undefined {
  if (response.status === 401 || response.status === 403) return undefined
  throw cause
}
