import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthenticationRequiredError,
  InvalidCredentialsError,
  TaskAccessDeniedError,
} from '../../identity/domain/identity-error.js';
import { ApplicationError } from '../application-error.js';

@Catch()
export class ApplicationErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error = exception instanceof ApplicationError ? exception : undefined;
    const status = this.statusFor(exception, error);
    const message =
      error?.message ??
      this.identityErrorMessage(exception) ??
      (status >= 500 ? 'Internal server error' : 'Invalid request');
    response.status(status).json({ error: message });
  }

  private statusFor(
    exception: unknown,
    applicationError: ApplicationError | undefined,
  ): number {
    if (applicationError) return applicationError.status;
    if (
      exception instanceof AuthenticationRequiredError ||
      exception instanceof InvalidCredentialsError
    )
      return 401;
    if (exception instanceof TaskAccessDeniedError) return 403;
    return exception instanceof HttpException ? exception.getStatus() : 500;
  }

  private identityErrorMessage(exception: unknown): string | undefined {
    return exception instanceof AuthenticationRequiredError ||
      exception instanceof InvalidCredentialsError ||
      exception instanceof TaskAccessDeniedError
      ? exception.message
      : undefined;
  }
}
