import { createContext, useContext } from 'react'
import type {
  AuthenticatedUser,
  Credentials,
} from '../../application/ports/AuthenticationService'

export type AuthenticationState =
  | { readonly kind: 'resolving' }
  | AnonymousAuthenticationState
  | AuthenticatedAuthenticationState
  | { readonly kind: 'error'; readonly retry: () => void }

interface AnonymousAuthenticationState {
  readonly kind: 'anonymous'
  readonly redirectToLogin?: boolean
  readonly preserveBoardLocation?: boolean
  login(credentials: Credentials): Promise<AuthenticatedUser>
  authenticate(user: AuthenticatedUser, destination: string): void
}

interface AuthenticatedAuthenticationState {
  readonly kind: 'authenticated'
  readonly user: AuthenticatedUser
  readonly loginDestination?: string
  logout(): Promise<void>
  invalidateUnauthorizedSession(): Promise<void>
}

export const AuthenticationContext = createContext<
  AuthenticationState | undefined
>(undefined)

export function useAuthentication(): AuthenticationState {
  const authentication = useContext(AuthenticationContext)
  if (authentication === undefined) {
    throw new Error('useAuthentication must be used within an AuthProvider.')
  }
  return authentication
}
