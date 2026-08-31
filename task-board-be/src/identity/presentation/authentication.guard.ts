import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationService } from '../application/authentication.service.js';
import { sessionToken } from '../../shared/http/session-token.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { IS_PUBLIC_ROUTE } from './route-access.decorator.js';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authentication: AuthenticationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = sessionToken(request);
    request.authenticatedUser = this.authentication.currentUser(token);
    request.sessionToken = token;
    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
