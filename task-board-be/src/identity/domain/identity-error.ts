export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication is required');
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
  }
}

export class TaskAccessDeniedError extends Error {
  constructor() {
    super('Task access is denied');
  }
}
