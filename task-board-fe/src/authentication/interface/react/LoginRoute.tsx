import { Navigate, useLocation } from 'react-router-dom'
import { AuthenticationRoute } from './AuthenticationRoute'
import { LoginPage } from './LoginPage'
import { isBoardReturnTo } from './returnTo'

export function LoginRoute() {
  const location = useLocation()
  return (
    <AuthenticationRoute>
      {(authentication) => {
        if (authentication.kind === 'authenticated') {
          return (
            <Navigate
              to={authentication.loginDestination ?? '/board'}
              replace
            />
          )
        }
        if (!hasValidReturnTo(location.search)) {
          return <Navigate to="/login" replace />
        }
        return <LoginPage />
      }}
    </AuthenticationRoute>
  )
}

function hasValidReturnTo(search: string): boolean {
  const returnTo = new URLSearchParams(search).get('returnTo')
  return returnTo === null || isBoardReturnTo(returnTo)
}
