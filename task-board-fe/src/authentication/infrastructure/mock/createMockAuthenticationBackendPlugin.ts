import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type {
  HttpMethod,
  HttpRequest,
  HttpResponse,
} from '../../../shared/infrastructure/http/HttpClient.js'
import { MockAuthenticationBackend } from './MockAuthenticationBackend.js'

const MOCK_ENDPOINTS = new Set([
  '/auth/session',
  '/auth/login',
  '/auth/logout',
  '/tasks',
])

export function createMockAuthenticationBackendPlugin(): Plugin {
  const backend = new MockAuthenticationBackend()
  return {
    name: 'mock-authentication-backend',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void handleRequest(backend, request, response, next)
      })
    },
  }
}

async function handleRequest(
  backend: MockAuthenticationBackend,
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: Error) => void,
): Promise<void> {
  const path = requestPath(request)
  if (!isMockEndpoint(path)) {
    next()
    return
  }
  try {
    const result = await backend.handle(await toHttpRequest(request, path))
    sendResponse(response, result)
  } catch (error) {
    next(error instanceof Error ? error : new Error(String(error)))
  }
}

function requestPath(request: IncomingMessage): string {
  const url = new URL(request.url ?? '/', 'http://localhost')
  return `${url.pathname}${url.search}`
}

async function toHttpRequest(
  request: IncomingMessage,
  path: string,
): Promise<HttpRequest> {
  return {
    method: httpMethod(request.method),
    path,
    headers: cookieHeader(request),
    body: await requestBody(request),
  }
}

function httpMethod(method: string | undefined): HttpMethod {
  if (
    method === 'GET' ||
    method === 'POST' ||
    method === 'PUT' ||
    method === 'DELETE'
  ) {
    return method
  }
  throw new Error(`Unsupported HTTP method: ${method ?? 'undefined'}`)
}

function cookieHeader(
  request: IncomingMessage,
): Readonly<Record<string, string>> | undefined {
  const cookie = request.headers.cookie
  return cookie === undefined ? undefined : { cookie }
}

async function requestBody(request: IncomingMessage): Promise<unknown> {
  if (request.method !== 'POST' && request.method !== 'PUT') return undefined
  const body = await readRequestBody(request)
  return body.length === 0 ? undefined : JSON.parse(body)
}

function taskPath(path: string): string {
  return path.split('?')[0]
}

function isMockEndpoint(path: string): boolean {
  const pathname = taskPath(path)
  return MOCK_ENDPOINTS.has(pathname) || pathname.startsWith('/tasks/')
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendResponse(response: ServerResponse, result: HttpResponse): void {
  response.statusCode = result.status
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value)
  }
  if (result.body !== undefined) {
    response.setHeader('content-type', 'application/json')
  }
  response.end(
    result.body === undefined ? undefined : JSON.stringify(result.body),
  )
}
