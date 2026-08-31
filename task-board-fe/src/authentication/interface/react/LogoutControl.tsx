import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthentication } from './AuthenticationContext'

export function LogoutControl() {
  const authentication = useAuthentication()
  const navigate = useNavigate()
  const [error, setError] = useState<string | undefined>(undefined)
  if (authentication.kind !== 'authenticated') return null

  const logout = async () => {
    setError(undefined)
    try {
      await authentication.logout()
      navigate('/login', { replace: true })
    } catch {
      setError('We could not log you out. Please try again.')
    }
  }

  return (
    <div className="logout-control">
      <button
        className="button button--secondary"
        type="button"
        onClick={logout}
      >
        Log out
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
