export class InvalidCredentialsError extends Error {
  constructor() {
    super('The supplied credentials are invalid.')
    this.name = 'InvalidCredentialsError'
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication is required.')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Access is forbidden.')
    this.name = 'ForbiddenError'
  }
}

export class AuthenticationServiceError extends Error {
  constructor(options?: ErrorOptions) {
    super('Authentication request failed.', options)
    this.name = 'AuthenticationServiceError'
  }
}

export class MalformedAuthenticationResponseError extends Error {
  constructor() {
    super(
      'Authentication service returned an invalid authenticated-user response.',
    )
    this.name = 'MalformedAuthenticationResponseError'
  }
}
