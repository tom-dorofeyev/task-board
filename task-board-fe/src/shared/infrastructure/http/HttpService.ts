import type { HttpClient, HttpMethod, HttpResponse } from './HttpClient'

export interface HttpServiceRequestOptions {
  readonly credentials?: 'include'
  readonly headers?: Readonly<Record<string, string>>
}

export class HttpService {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  get(
    path: string,
    options?: HttpServiceRequestOptions,
  ): Promise<HttpResponse> {
    return this.request('GET', path, undefined, options)
  }

  post(
    path: string,
    body?: unknown,
    options?: HttpServiceRequestOptions,
  ): Promise<HttpResponse> {
    return this.request('POST', path, body, options)
  }

  put(
    path: string,
    body?: unknown,
    options?: HttpServiceRequestOptions,
  ): Promise<HttpResponse> {
    return this.request('PUT', path, body, options)
  }

  delete(
    path: string,
    options?: HttpServiceRequestOptions,
  ): Promise<HttpResponse> {
    return this.request('DELETE', path, undefined, options)
  }

  private request(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpServiceRequestOptions | undefined,
  ): Promise<HttpResponse> {
    return this.client.execute({
      method,
      path,
      ...(body === undefined ? {} : { body }),
      ...options,
    })
  }
}
