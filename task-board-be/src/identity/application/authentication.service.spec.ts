import { describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '../../shared/application-error.js';
import type { IdentityStore } from './identity-store.js';
import { AuthenticationService } from './authentication.service.js';

describe('AuthenticationService', () => {
  it('validates credentials before using the identity store', () => {
    const identityStore = fakeIdentityStore();
    const service = new AuthenticationService(identityStore);

    expect(() => service.login(undefined, 'password')).toThrow(
      new ApplicationError(400, 'username and password are required'),
    );
    expect(identityStore.authenticate).not.toHaveBeenCalled();
  });
});

function fakeIdentityStore(): IdentityStore {
  return {
    authenticate: vi.fn(),
    resolve: vi.fn(),
    revoke: vi.fn(),
    sessionDurationMilliseconds: vi.fn(),
  };
}
