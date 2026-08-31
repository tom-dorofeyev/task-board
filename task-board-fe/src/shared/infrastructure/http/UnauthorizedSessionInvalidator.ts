export interface UnauthorizedSessionInvalidator {
  invalidateUnauthorizedSession(): Promise<void>
}
