export interface AuthenticatedUser {
  readonly id: string
  readonly username: string
  readonly displayName: string
}

export interface Credentials {
  readonly username: string
  readonly password: string
}

export type Session = AuthenticatedSession | AnonymousSession

export interface AuthenticatedSession {
  readonly kind: 'authenticated'
  readonly user: AuthenticatedUser
}

export interface AnonymousSession {
  readonly kind: 'anonymous'
}

export interface AuthenticationService {
  getSession(): Promise<Session>
  login(credentials: Credentials): Promise<AuthenticatedUser>
  logout(): Promise<void>
}
