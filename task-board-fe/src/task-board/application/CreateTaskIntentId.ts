export class CreateTaskIntentValidationError extends Error {
  readonly field = 'idempotencyKey'

  constructor() {
    super('Create task intent ID is required')
    this.name = 'CreateTaskIntentValidationError'
  }
}

export function requireCreateTaskIntentId(value: string): string {
  if (value.trim().length === 0) throw new CreateTaskIntentValidationError()
  return value
}
