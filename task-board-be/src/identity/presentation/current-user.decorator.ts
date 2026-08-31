import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AuthenticationRequiredError } from '../domain/identity-error.js';
import type { User } from '../domain/user.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authenticatedUser) throw new AuthenticationRequiredError();
    return request.authenticatedUser;
  },
);
