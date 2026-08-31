import type { AuthenticationService } from './authentication/application/ports/AuthenticationService'
import { createBrowserAuthenticationService } from './authentication/infrastructure/http/createBrowserAuthenticationService'
import { AuthProvider } from './authentication/interface/react/AuthProvider'
import { AppRoutes } from './app/interface/react/AppRoutes'

interface AppProps {
  readonly authenticationService?: AuthenticationService
}

const browserAuthenticationService = createBrowserAuthenticationService()

function App({
  authenticationService = browserAuthenticationService,
}: AppProps) {
  return (
    <AuthProvider authenticationService={authenticationService}>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
