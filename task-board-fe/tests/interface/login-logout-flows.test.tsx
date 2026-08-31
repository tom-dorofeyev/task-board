import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type {
  AuthenticatedUser,
  AuthenticationService,
  Session,
} from '../../src/authentication/application/ports/AuthenticationService'
import App from '../../src/App'

const USER: AuthenticatedUser = {
  id: 'user-1',
  username: 'alex',
  displayName: 'Alex Rivera',
}

test('valid login restores the validated return destination', async () => {
  const user = renderApp('/login?returnTo=%2Fboard%2Fnew-task')

  await logIn(user)

  await expectLocation('/board/new-task')
})

test('valid login without a return destination opens the board', async () => {
  const user = renderApp('/login')

  await logIn(user)

  await expectLocation('/board')
})

test('invalid login retains the anonymous login form with an accessible error', async () => {
  const user = renderApp(
    '/login',
    authenticationService({ login: new Error('Invalid') }),
  )

  await logIn(user)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not log you in',
  )
  expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
})

test('successful logout clears authentication and opens login', async () => {
  const user = renderApp(
    '/board',
    authenticationService({ session: authenticatedSession() }),
  )

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  await expectLocation('/login')
})

test('failed logout retains board access and shows an accessible error', async () => {
  const user = renderApp(
    '/board',
    authenticationService({
      session: authenticatedSession(),
      logout: new Error('Offline'),
    }),
  )

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not log you out',
  )
  expect(
    screen.getByRole('heading', { name: 'Product roadmap' }),
  ).toBeInTheDocument()
})

function renderApp(path: string, service = authenticationService()) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App authenticationService={service} />
      <CurrentLocation />
    </MemoryRouter>,
  )
  return user
}

async function logIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByRole('textbox', { name: 'Username' }),
    USER.username,
  )
  await user.type(screen.getByLabelText('Password'), 'password')
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

async function expectLocation(location: string) {
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(location),
  )
}

function authenticationService({
  session = 'anonymous',
  login = USER,
  logout,
}: {
  session?: Session | 'anonymous'
  login?: AuthenticatedUser | Error
  logout?: Error
} = {}): AuthenticationService {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    login:
      login instanceof Error
        ? vi.fn().mockRejectedValue(login)
        : vi.fn().mockResolvedValue(login),
    logout:
      logout === undefined
        ? vi.fn().mockResolvedValue(undefined)
        : vi.fn().mockRejectedValue(logout),
  }
}

function authenticatedSession(): Session {
  return { kind: 'authenticated', user: USER }
}

function CurrentLocation() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}
