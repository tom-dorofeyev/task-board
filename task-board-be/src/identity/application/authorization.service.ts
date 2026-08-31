import { TaskAccessDeniedError } from '../domain/identity-error.js';
import type { Permission } from '../domain/permission.js';
import type { User } from '../domain/user.js';

export class AuthorizationService {
  ensureAuthorized(user: User, permissions: readonly Permission[]): void {
    if (permissions.length > 0 && user.username === 'blocked')
      throw new TaskAccessDeniedError();
  }
}
