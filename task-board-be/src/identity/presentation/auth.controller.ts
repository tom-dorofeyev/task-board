import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticationService } from '../application/authentication.service.js';
import type { User } from '../domain/user.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './route-access.decorator.js';
import {
  expiredSessionCookieOptions,
  sessionCookieOptions,
} from './session-cookie-options.js';
import { SessionToken } from './session-token.decorator.js';

const SESSION_COOKIE_NAME = 'task_board_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authentication: AuthenticationService) {}

  @Get('session')
  session(@CurrentUser() user: User): { user: User } {
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  login(
    @Body() credentials: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): { user: User } {
    const login = this.authentication.login(
      credentials?.username,
      credentials?.password,
    );
    response.cookie(
      SESSION_COOKIE_NAME,
      login.token,
      sessionCookieOptions(this.authentication.sessionDurationMilliseconds()),
    );
    return { user: login.user };
  }

  @Post('logout')
  logout(
    @SessionToken() token: string | undefined,
    @Res() response: Response,
  ): void {
    this.authentication.logout(token);
    response.cookie(SESSION_COOKIE_NAME, '', expiredSessionCookieOptions());
    response.status(204).send();
  }
}
