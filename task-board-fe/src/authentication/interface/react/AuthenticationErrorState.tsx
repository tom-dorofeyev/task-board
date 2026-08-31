interface AuthenticationErrorStateProps {
  readonly onRetry: () => void
}

export function AuthenticationErrorState({
  onRetry,
}: AuthenticationErrorStateProps) {
  return (
    <main className="board-state">
      <h1>Session unavailable</h1>
      <p role="alert">We could not check your session. Try again.</p>
      <button
        className="button button--primary"
        type="button"
        onClick={onRetry}
      >
        Retry
      </button>
    </main>
  )
}
