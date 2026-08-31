import type { ReactNode } from 'react'
import {
  type AuthenticationState,
  useAuthentication,
} from './AuthenticationContext'
import { AuthLoadingState } from './AuthLoadingState'
import { AuthenticationErrorState } from './AuthenticationErrorState'

interface AuthenticationRouteProps {
  readonly children: (authentication: ReadyAuthenticationState) => ReactNode
}

export function AuthenticationRoute({ children }: AuthenticationRouteProps) {
  const authentication = useAuthentication()
  if (authentication.kind === 'resolving') return <AuthLoadingState />
  if (authentication.kind === 'error') {
    return <AuthenticationErrorState onRetry={authentication.retry} />
  }
  return children(authentication)
}

export type ReadyAuthenticationState = Exclude<
  AuthenticationState,
  { readonly kind: 'resolving' | 'error' }
>
