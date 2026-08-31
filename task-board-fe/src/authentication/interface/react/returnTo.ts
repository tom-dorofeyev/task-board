export function isBoardReturnTo(returnTo: string): boolean {
  return normalizedBoardPathname(returnTo) !== undefined
}

export function loginDestination(search: string): string {
  const returnTo = new URLSearchParams(search).get('returnTo')
  return returnTo !== null && isBoardReturnTo(returnTo) ? returnTo : '/board'
}

function normalizedBoardPathname(returnTo: string): string | undefined {
  if (containsControlCharacter(returnTo)) return undefined
  try {
    const base = applicationOrigin()
    const destination = new URL(returnTo, base)
    if (
      destination.origin !== base ||
      destination.username ||
      destination.password
    ) {
      return undefined
    }
    const pathname = decodedPathname(destination.pathname)
    if (pathname === undefined) return undefined
    const normalizedPathname = new URL(pathname, base).pathname
    return hasBoardPathBoundary(normalizedPathname)
      ? normalizedPathname
      : undefined
  } catch {
    return undefined
  }
}

function applicationOrigin(): string {
  return typeof window === 'undefined'
    ? 'https://task-board.invalid'
    : window.location.origin
}

function decodedPathname(pathname: string): string | undefined {
  try {
    let decodedPathname = pathname
    while (/%[\da-f]{2}/i.test(decodedPathname))
      decodedPathname = decodeURIComponent(decodedPathname)
    if (
      decodedPathname.includes('\\') ||
      decodedPathname.includes('?') ||
      decodedPathname.includes('#') ||
      containsControlCharacter(decodedPathname)
    ) {
      return undefined
    }
    return decodedPathname
  } catch {
    return undefined
  }
}

function hasBoardPathBoundary(pathname: string): boolean {
  const pathBoundary = pathname.charAt('/board'.length)
  return (
    pathname.startsWith('/board') &&
    (pathBoundary === '' || pathBoundary === '/')
  )
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) < 32)
}
