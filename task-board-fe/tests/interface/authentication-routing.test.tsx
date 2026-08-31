import { StrictMode, useEffect, useRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type {
  AuthenticationService,
  Session,
} from '../../src/authentication/application/ports/AuthenticationService'
import App from '../../src/App'
import { AuthProvider } from '../../src/authentication/interface/react/AuthProvider'
import { useAuthentication } from '../../src/authentication/interface/react/AuthenticationContext'

const AUTHENTICATED_SESSION: Session = {
  kind: 'authenticated',
  user: { id: 'user-1', username: 'alex', displayName: 'Alex Rivera' },
}

test('does not mount board content while the session is resolving', () => {
  renderApp('/board', serviceWith(new Promise<Session>(() => undefined)))

  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Product roadmap' }),
  ).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('does not mount login content while the session is resolving', () => {
  renderApp('/login', serviceWith(new Promise<Session>(() => undefined)))

  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Log in' }),
  ).not.toBeInTheDocument()
})

test('redirects anonymous board deep links with their complete destination', async () => {
  renderApp('/board/task-101?view=compact#details', serviceWith('anonymous'))

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/login?returnTo=%2Fboard%2Ftask-101%3Fview%3Dcompact%23details',
    ),
  )
})

test('redirects authenticated visitors from login to the board', async () => {
  renderApp(
    '/login?returnTo=https://attacker.example',
    serviceWith(AUTHENTICATED_SESSION),
  )

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent('/board'),
  )
})

test('removes an invalid return destination from anonymous login navigation', async () => {
  renderApp(
    '/login?returnTo=https://attacker.example',
    serviceWith('anonymous'),
  )

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      /^\/login$/,
    ),
  )
})

test('removes encoded traversal from an anonymous login destination', async () => {
  renderApp(
    '/login?returnTo=%2Fboard%2F%252e%252e%2Flogin',
    serviceWith('anonymous'),
  )

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      /^\/login$/,
    ),
  )
})

test('shows an accessible retry state for a rejected session check', async () => {
  const authenticationService = serviceWith(new Error('Network unavailable'))
  renderApp('/board', authenticationService)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not check your session',
  )
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  expect(screen.getByTestId('current-location')).toHaveTextContent('/board')
})

test('shows the session error state instead of login content on the login route', async () => {
  renderApp('/login', serviceWith(new Error('Network unavailable')))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not check your session',
  )
  expect(
    screen.queryByRole('heading', { name: 'Log in' }),
  ).not.toBeInTheDocument()
})

test('retries a failed session check without redirecting to login', async () => {
  const authenticationService = sessionSequence(
    new Error('Network unavailable'),
    new Error('Network unavailable'),
    new Error('Network unavailable'),
  )
  const user = renderApp('/board', authenticationService)

  await user.click(await screen.findByRole('button', { name: 'Retry' }))

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not check your session',
    ),
  )
  expect(screen.getByTestId('current-location')).toHaveTextContent('/board')
  expect(authenticationService.getSession).toHaveBeenCalledTimes(2)

  await user.click(screen.getByRole('button', { name: 'Retry' }))

  await waitFor(() =>
    expect(authenticationService.getSession).toHaveBeenCalledTimes(3),
  )
})

test('retries a failed session check and renders the recovered board', async () => {
  const authenticationService = sessionSequence(
    new Error('Network unavailable'),
    AUTHENTICATED_SESSION,
  )
  const user = renderApp('/board', authenticationService)

  await user.click(await screen.findByRole('button', { name: 'Retry' }))

  expect(
    await screen.findByRole('heading', { name: 'Product roadmap' }),
  ).toBeInTheDocument()
  expect(authenticationService.getSession).toHaveBeenCalledTimes(2)
})

test('refetches the session when the authentication service changes', async () => {
  const initialService = serviceWith(AUTHENTICATED_SESSION)
  const replacementService = serviceWith('anonymous')
  const rendered = render(
    <MemoryRouter initialEntries={['/board']}>
      <App authenticationService={initialService} />
      <CurrentLocation />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Product roadmap' })
  rendered.rerender(
    <MemoryRouter initialEntries={['/board']}>
      <App authenticationService={replacementService} />
      <CurrentLocation />
    </MemoryRouter>,
  )

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/login?returnTo=%2Fboard',
    ),
  )
  expect(initialService.getSession).toHaveBeenCalledTimes(1)
  expect(replacementService.getSession).toHaveBeenCalledTimes(1)
})

test('ignores a stale session result after the authentication service changes', async () => {
  let resolveInitialSession: (session: Session) => void = () => undefined
  const initialService = serviceWith(
    new Promise<Session>((resolve) => {
      resolveInitialSession = resolve
    }),
  )
  const replacementService = serviceWith('anonymous')
  const rendered = render(
    <MemoryRouter initialEntries={['/board']}>
      <App authenticationService={initialService} />
      <CurrentLocation />
    </MemoryRouter>,
  )

  await waitFor(() =>
    expect(initialService.getSession).toHaveBeenCalledTimes(1),
  )
  rendered.rerender(
    <MemoryRouter initialEntries={['/board']}>
      <App authenticationService={replacementService} />
      <CurrentLocation />
    </MemoryRouter>,
  )
  resolveInitialSession(AUTHENTICATED_SESSION)

  await waitFor(() =>
    expect(screen.getByTestId('current-location')).toHaveTextContent(
      '/login?returnTo=%2Fboard',
    ),
  )
  expect(replacementService.getSession).toHaveBeenCalledTimes(1)
})

test('deduplicates the session check during StrictMode effect replay', async () => {
  const authenticationService = serviceWith('anonymous')
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/board']}>
        <App authenticationService={authenticationService} />
      </MemoryRouter>
    </StrictMode>,
  )

  await screen.findByRole('heading', { name: 'Log in' })

  expect(authenticationService.getSession).toHaveBeenCalledTimes(1)
})

test('does not accept an obsolete same-service retry result', async () => {
  const second = deferredSession()
  const third = deferredSession()
  const authenticationService = sessionSequence(
    new Error('Network unavailable'),
    second.promise,
    third.promise,
  )
  const user = userEvent.setup()

  render(
    <AuthProvider authenticationService={authenticationService}>
      <AuthenticationProbe />
    </AuthProvider>,
  )

  await waitFor(() =>
    expect(screen.getByTestId('authentication-kind')).toHaveTextContent(
      'error',
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Retry session' }))
  await waitFor(() =>
    expect(authenticationService.getSession).toHaveBeenCalledTimes(2),
  )
  await user.click(screen.getByRole('button', { name: 'Retry session' }))
  await waitFor(() =>
    expect(authenticationService.getSession).toHaveBeenCalledTimes(3),
  )

  second.resolve(AUTHENTICATED_SESSION)
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(screen.getByTestId('authentication-kind')).toHaveTextContent(
    'resolving',
  )

  third.resolve('anonymous')
  await waitFor(() =>
    expect(screen.getByTestId('authentication-kind')).toHaveTextContent(
      'anonymous',
    ),
  )
})

test('rejects authentication context use outside its provider', () => {
  expect(() => render(<AuthenticationProbe />)).toThrow(
    'useAuthentication must be used within an AuthProvider.',
  )
})

test('renders an accessible not-found page for unknown paths', () => {
  renderApp('/unknown-path', serviceWith('anonymous'))

  expect(
    screen.getByRole('heading', { name: 'Page not found' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText('The requested page does not exist.'),
  ).toBeInTheDocument()
})

function renderApp(path: string, authenticationService: AuthenticationService) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App authenticationService={authenticationService} />
      <CurrentLocation />
    </MemoryRouter>,
  )
  return user
}

function serviceWith(
  session: Session | Error | Promise<Session>,
): AuthenticationService {
  return {
    getSession:
      session instanceof Error
        ? vi.fn().mockRejectedValue(session)
        : vi.fn().mockResolvedValue(session),
    login: vi.fn(),
    logout: vi.fn(),
  }
}

function sessionSequence(
  ...sessions: Array<Session | Error | Promise<Session>>
): AuthenticationService {
  const getSession = vi.fn()
  for (const session of sessions) {
    if (session instanceof Error) getSession.mockRejectedValueOnce(session)
    else getSession.mockResolvedValueOnce(session)
  }
  return { getSession, login: vi.fn(), logout: vi.fn() }
}

function deferredSession() {
  let resolve: (session: Session) => void = () => undefined
  const promise = new Promise<Session>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function AuthenticationProbe() {
  const authentication = useAuthentication()
  const retry = useRef<() => void>(() => undefined)
  useEffect(() => {
    if (authentication.kind === 'error') retry.current = authentication.retry
  }, [authentication])
  return (
    <>
      <output data-testid="authentication-kind">{authentication.kind}</output>
      <button type="button" onClick={() => retry.current()}>
        Retry session
      </button>
    </>
  )
}

function CurrentLocation() {
  const location = useLocation()
  return (
    <output data-testid="current-location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}
