import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../application/authorization.service.js';
import { AuthenticationRequiredError } from '../domain/identity-error.js';
import type { Permission } from '../domain/permission.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import {
  IS_PUBLIC_ROUTE,
  REQUIRED_PERMISSIONS,
} from './route-access.decorator.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublicRoute(context)) return true;
    const permissions = this.requiredPermissions(context);
    if (permissions.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authenticatedUser) throw new AuthenticationRequiredError();
    this.authorization.ensureAuthorized(request.authenticatedUser, permissions);
    return true;
  }

  private requiredPermissions(context: ExecutionContext): Permission[] {
    return (
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
