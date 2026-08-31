import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  AuthenticationRequiredError,
  InvalidCredentialsError,
} from '../domain/identity-error.js';
import type { Session, User } from '../domain/user.js';
import type { IdentityStore } from '../application/identity-store.js';

const SESSION_DURATION_SECONDS = 60 * 60 * 8;
const DEMO_PASSWORD =
  process.env.TASK_BOARD_DEMO_PASSWORD ??
  (process.env.NODE_ENV === 'production' ? undefined : 'password');
const DEMO_PASSWORD_HASH = DEMO_PASSWORD
  ? scryptSync(DEMO_PASSWORD, 'task-board-demo-user', 64)
  : undefined;

@Injectable()
export class InMemoryIdentityStore implements IdentityStore {
  private readonly sessions = new Map<string, Session>();
  private readonly users = DEMO_PASSWORD_HASH
    ? new Map<string, User>([
        [
          'demo',
          { id: 'user-demo', username: 'demo', displayName: 'Demo User' },
        ],
        [
          'blocked',
          {
            id: 'user-blocked',
            username: 'blocked',
            displayName: 'Blocked User',
          },
        ],
      ])
    : new Map<string, User>();

  authenticate(
    username: string,
    password: string,
  ): { user: User; token: string } {
    const user = this.users.get(username);
    if (!user || !this.hasValidPassword(password))
      throw new InvalidCredentialsError();
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, {
      user,
      expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
    });
    return { user, token };
  }

  resolve(token: string | undefined): User {
    const session = token ? this.sessions.get(token) : undefined;
    if (!session || session.expiresAt <= Date.now())
      throw new AuthenticationRequiredError();
    return session.user;
  }

  revoke(token: string): void {
    this.sessions.delete(token);
  }

  sessionDurationMilliseconds(): number {
    return SESSION_DURATION_SECONDS * 1000;
  }

  private hasValidPassword(password: string): boolean {
    return (
      DEMO_PASSWORD_HASH !== undefined &&
      timingSafeEqual(
        scryptSync(password, 'task-board-demo-user', 64),
        DEMO_PASSWORD_HASH,
      )
    );
  }
}
