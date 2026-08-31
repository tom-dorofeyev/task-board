import { CookieHttpRequestBoundary } from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'
import { FetchHttpClient } from '../../../shared/infrastructure/http/FetchHttpClient'
import { HttpService } from '../../../shared/infrastructure/http/HttpService'
import type { AuthenticationService } from '../../application/ports/AuthenticationService'
import { HttpAuthenticationService } from './HttpAuthenticationService'

export function createBrowserAuthenticationService(): AuthenticationService {
  const requests = new CookieHttpRequestBoundary(
    new HttpService(new FetchHttpClient()),
    { invalidateUnauthorizedSession: async () => undefined },
  )
  return new HttpAuthenticationService(requests)
}
