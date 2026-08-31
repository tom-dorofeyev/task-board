import { createContext, useContext } from 'react'
import type { CookieHttpService } from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'

export const AuthenticatedRequestsContext = createContext<
  CookieHttpService | undefined
>(undefined)

export function useAuthenticatedRequests(): CookieHttpService {
  const requests = useContext(AuthenticatedRequestsContext)
  if (requests === undefined) {
    throw new Error(
      'useAuthenticatedRequests must be used within an AuthProvider.',
    )
  }
  return requests
}
