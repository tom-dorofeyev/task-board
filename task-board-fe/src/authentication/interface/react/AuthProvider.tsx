import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type {
  AuthenticatedUser,
  AuthenticationService,
  Credentials,
  Session,
} from '../../application/ports/AuthenticationService'
import {
  AuthenticationContext,
  type AuthenticationState,
} from './AuthenticationContext'
import { AuthenticatedRequestsContext } from './AuthenticatedRequestsContext'
import { CookieHttpRequestBoundary } from '../../../shared/infrastructure/http/CookieHttpRequestBoundary'
import { FetchHttpClient } from '../../../shared/infrastructure/http/FetchHttpClient'
import { HttpService } from '../../../shared/infrastructure/http/HttpService'

interface AuthProviderProps {
  readonly authenticationService: AuthenticationService
  readonly children: ReactNode
}

export function AuthProvider({
  authenticationService,
  children,
}: AuthProviderProps) {
  const [sessionResult, setSessionResult] = useState<SessionResult | undefined>(
    undefined,
  )
  const [requestVersion, setRequestVersion] = useState(0)
  const sessionRequest = useRef<SessionRequest | undefined>(undefined)
  const retry = useCallback(
    () => setRequestVersion((version) => version + 1),
    [],
  )
  const login = useCallback(
    (credentials: Credentials) => authenticationService.login(credentials),
    [authenticationService],
  )
  const authenticate = useCallback(
    (user: AuthenticatedUser, loginDestination: string) =>
      setSessionResult(
        authenticatedResult(
          authenticationService,
          requestVersion,
          user,
          loginDestination,
        ),
      ),
    [authenticationService, requestVersion],
  )
  const logout = useCallback(async () => {
    await authenticationService.logout()
    setSessionResult(logoutResult(authenticationService, requestVersion))
  }, [authenticationService, requestVersion])
  const invalidateUnauthorizedSession = useCallback(async () => {
    setSessionResult(unauthorizedResult(authenticationService, requestVersion))
  }, [authenticationService, requestVersion])
  const authenticatedRequests = useMemo(
    () =>
      new CookieHttpRequestBoundary(new HttpService(new FetchHttpClient()), {
        invalidateUnauthorizedSession,
      }),
    [invalidateUnauthorizedSession],
  )

  useEffect(() => {
    let active = true
    const request = currentSessionRequest(
      sessionRequest,
      authenticationService,
      requestVersion,
    )
    void request.then(
      (session) =>
        active &&
        setSessionResult({
          service: authenticationService,
          version: requestVersion,
          authentication: authenticationState(session),
        }),
      () =>
        active &&
        setSessionResult({
          service: authenticationService,
          version: requestVersion,
          authentication: { kind: 'error', retry },
        }),
    )
    return () => {
      active = false
    }
  }, [authenticationService, requestVersion, retry])

  const authentication = authenticationFor(
    sessionResult,
    authenticationService,
    requestVersion,
    login,
    authenticate,
    logout,
    invalidateUnauthorizedSession,
  )

  return (
    <AuthenticationContext.Provider value={authentication}>
      <AuthenticatedRequestsContext value={authenticatedRequests}>
        {children}
      </AuthenticatedRequestsContext>
    </AuthenticationContext.Provider>
  )
}

interface SessionRequest {
  readonly service: AuthenticationService
  readonly version: number
  readonly request: Promise<Session>
}

interface SessionResult extends SessionRequestIdentity {
  readonly authentication: ResolvedAuthenticationState
}

interface SessionRequestIdentity {
  readonly service: AuthenticationService
  readonly version: number
}

function authenticationFor(
  sessionResult: SessionResult | undefined,
  authenticationService: AuthenticationService,
  requestVersion: number,
  login: (credentials: Credentials) => Promise<AuthenticatedUser>,
  authenticate: (user: AuthenticatedUser, destination: string) => void,
  logout: () => Promise<void>,
  invalidateUnauthorizedSession: () => Promise<void>,
): AuthenticationState {
  if (
    sessionResult?.service === authenticationService &&
    sessionResult.version === requestVersion
  ) {
    return sessionActions(
      sessionResult.authentication,
      login,
      authenticate,
      logout,
      invalidateUnauthorizedSession,
    )
  }
  return { kind: 'resolving' }
}

function currentSessionRequest(
  sessionRequest: MutableRefObject<SessionRequest | undefined>,
  authenticationService: AuthenticationService,
  requestVersion: number,
): Promise<Session> {
  const currentRequest = sessionRequest.current
  if (
    currentRequest?.service === authenticationService &&
    currentRequest.version === requestVersion
  ) {
    return currentRequest.request
  }
  const request = Promise.resolve().then(() =>
    authenticationService.getSession(),
  )
  sessionRequest.current = {
    service: authenticationService,
    version: requestVersion,
    request,
  }
  return request
}

function authenticationState(session: Session): ResolvedAuthenticationState {
  if (session.kind === 'authenticated') return session
  return { kind: 'anonymous' }
}

function sessionActions(
  authentication: ResolvedAuthenticationState,
  login: (credentials: Credentials) => Promise<AuthenticatedUser>,
  authenticate: (user: AuthenticatedUser, destination: string) => void,
  logout: () => Promise<void>,
  invalidateUnauthorizedSession: () => Promise<void>,
): AuthenticationState {
  if (authentication.kind === 'anonymous') {
    return { ...authentication, login, authenticate }
  }
  if (authentication.kind === 'authenticated') {
    return { ...authentication, logout, invalidateUnauthorizedSession }
  }
  return authentication
}

type ResolvedAuthenticationState =
  | AnonymousSessionState
  | AuthenticatedSessionState
  | { readonly kind: 'error'; readonly retry: () => void }

interface AuthenticatedSessionState {
  readonly kind: 'authenticated'
  readonly user: AuthenticatedUser
  readonly loginDestination?: string
}

interface AnonymousSessionState {
  readonly kind: 'anonymous'
  readonly redirectToLogin?: boolean
  readonly preserveBoardLocation?: boolean
}

function authenticatedResult(
  service: AuthenticationService,
  version: number,
  user: AuthenticatedUser,
  loginDestination?: string,
): SessionResult {
  return {
    service,
    version,
    authentication: { kind: 'authenticated', user, loginDestination },
  }
}

function logoutResult(
  service: AuthenticationService,
  version: number,
): SessionResult {
  return {
    service,
    version,
    authentication: { kind: 'anonymous', redirectToLogin: true },
  }
}

function unauthorizedResult(
  service: AuthenticationService,
  version: number,
): SessionResult {
  return {
    service,
    version,
    authentication: {
      kind: 'anonymous',
      redirectToLogin: true,
      preserveBoardLocation: true,
    },
  }
}
