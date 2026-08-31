import type { CookieOptions } from 'express';

export function sessionCookieOptions(
  maxAge: number,
  environment: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieRequiresHttps(environment),
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function expiredSessionCookieOptions(
  environment: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  return { ...sessionCookieOptions(0, environment), maxAge: 0 };
}

function cookieRequiresHttps(environment: NodeJS.ProcessEnv): boolean {
  if (environment.TASK_BOARD_COOKIE_SECURE === 'true') return true;
  if (environment.TASK_BOARD_COOKIE_SECURE === 'false') return false;
  return environment.NODE_ENV === 'production';
}
