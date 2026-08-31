export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface HttpRequest {
  readonly method: HttpMethod
  readonly path: string
  readonly credentials?: 'include'
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: unknown
}

export interface HttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body?: unknown
}

export interface HttpClient {
  execute(request: HttpRequest): Promise<HttpResponse>
}
