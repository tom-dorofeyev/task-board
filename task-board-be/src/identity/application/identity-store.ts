import type { User } from '../domain/user.js';

export const IDENTITY_STORE = Symbol('IdentityStore');

export interface IdentityStore {
  authenticate(
    username: string,
    password: string,
  ): { user: User; token: string };
  resolve(token: string | undefined): User;
  revoke(token: string): void;
  sessionDurationMilliseconds(): number;
}
