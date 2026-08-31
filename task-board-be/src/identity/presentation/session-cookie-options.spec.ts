import {
  expiredSessionCookieOptions,
  sessionCookieOptions,
} from './session-cookie-options.js';

describe('sessionCookieOptions', () => {
  it('allows HTTP cookies outside production by default', () => {
    expect(
      sessionCookieOptions(1000, { NODE_ENV: 'development' }),
    ).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000,
    });
  });

  it('requires HTTPS cookies in production by default', () => {
    expect(sessionCookieOptions(1000, { NODE_ENV: 'production' }).secure).toBe(
      true,
    );
  });

  it('allows the secure-cookie setting to require HTTPS outside production', () => {
    expect(
      sessionCookieOptions(1000, { TASK_BOARD_COOKIE_SECURE: 'true' }).secure,
    ).toBe(true);
  });

  it('honours the explicit secure-cookie setting for login and logout', () => {
    const environment = { TASK_BOARD_COOKIE_SECURE: 'false' };

    expect(sessionCookieOptions(1000, environment).secure).toBe(false);
    expect(expiredSessionCookieOptions(environment)).toMatchObject({
      secure: false,
      maxAge: 0,
    });
  });
});
