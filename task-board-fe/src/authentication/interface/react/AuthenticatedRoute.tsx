import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthenticationRoute } from './AuthenticationRoute'
import { LogoutControl } from './LogoutControl'

export function AuthenticatedRoute() {
  const location = useLocation()
  return (
    <AuthenticationRoute>
      {(authentication) => {
        if (authentication.kind === 'anonymous') {
          return (
            <Navigate to={loginDestination(authentication, location)} replace />
          )
        }
        return (
          <>
            <LogoutControl />
            <Outlet />
          </>
        )
      }}
    </AuthenticationRoute>
  )
}

function loginDestination(
  authentication: {
    readonly redirectToLogin?: boolean
    readonly preserveBoardLocation?: boolean
  },
  location: ReturnType<typeof useLocation>,
): string {
  if (authentication.redirectToLogin && !authentication.preserveBoardLocation) {
    return '/login'
  }
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return `/login?returnTo=${encodeURIComponent(returnTo)}`
}
