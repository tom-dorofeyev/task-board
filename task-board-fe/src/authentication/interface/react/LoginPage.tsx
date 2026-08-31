import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthentication } from './AuthenticationContext'
import { loginDestination } from './returnTo'

export function LoginPage() {
  const authentication = useAuthentication()
  const location = useLocation()
  const [error, setError] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (authentication.kind !== 'anonymous') return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSubmitting(true)
    setError(undefined)
    try {
      const authenticatedUser = await authentication.login({
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      authentication.authenticate(
        authenticatedUser,
        loginDestination(location.search),
      )
    } catch {
      setError('We could not log you in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="board-state">
      <h1>Log in</h1>
      <form className="login-form" onSubmit={submit}>
        <label className="form-field">
          Username
          <input name="username" autoComplete="username" required />
        </label>
        <label className="form-field">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary" disabled={isSubmitting}>
          Log in
        </button>
      </form>
    </main>
  )
}
