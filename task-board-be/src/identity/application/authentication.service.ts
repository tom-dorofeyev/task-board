import type { User } from '../domain/user.js';
import { ApplicationError } from '../../shared/application-error.js';
import type { IdentityStore } from './identity-store.js';

export class AuthenticationService {
  constructor(private readonly identityStore: IdentityStore) {}

  login(username: unknown, password: unknown): { user: User; token: string } {
    if (typeof username !== 'string' || typeof password !== 'string')
      throw new ApplicationError(400, 'username and password are required');
    return this.identityStore.authenticate(username, password);
  }

  currentUser(token: string | undefined): User {
    return this.identityStore.resolve(token);
  }

  logout(token: string | undefined): void {
    this.identityStore.resolve(token);
    if (token) this.identityStore.revoke(token);
  }

  sessionDurationMilliseconds(): number {
    return this.identityStore.sessionDurationMilliseconds();
  }
}
