import type { Request } from 'express';

const SESSION_COOKIE_NAME = 'task_board_session';

export function sessionToken(request: Request): string | undefined {
  return request.headers.cookie
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}
