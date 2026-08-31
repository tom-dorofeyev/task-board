import { LoadingIcon } from '../../../shared/interface/react/components/LoadingIcon'

export function AuthLoadingState() {
  return (
    <main className="board-state" aria-busy="true">
      <LoadingIcon />
      <p>Checking your session</p>
    </main>
  )
}
