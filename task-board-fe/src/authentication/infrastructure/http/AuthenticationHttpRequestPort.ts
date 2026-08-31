import type {
  HttpRequestOptions,
  HttpRequestResult,
} from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'

export interface AuthenticationHttpRequestPort {
  get(path: string, options?: HttpRequestOptions): Promise<HttpRequestResult>
  post(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpRequestResult>
}
