import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApplicationError } from '../../shared/application-error.js';
import type {
  TaskCursor,
  TaskCursorCodec,
} from '../application/task-cursor-codec.js';

const CURSOR_SECRET =
  process.env.TASK_BOARD_CURSOR_SECRET ?? randomBytes(32).toString('base64url');

export class HmacTaskCursorCodec implements TaskCursorCodec {
  encode(cursor: TaskCursor): string {
    const payload = Buffer.from(JSON.stringify(cursor)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  offset(token: unknown, expected: Omit<TaskCursor, 'offset'>): number {
    if (token === undefined) return 0;
    const cursor = this.decode(token);
    if (
      cursor.userId !== expected.userId ||
      cursor.status !== expected.status ||
      cursor.filterIdentity !== expected.filterIdentity ||
      !Number.isInteger(cursor.offset) ||
      cursor.offset < 0
    )
      throw new ApplicationError(400, 'Invalid continuation token');
    return cursor.offset;
  }

  private decode(token: unknown): TaskCursor {
    if (typeof token !== 'string')
      throw new ApplicationError(400, 'Invalid continuation token');
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !this.hasValidSignature(payload, signature))
      throw new ApplicationError(400, 'Invalid continuation token');
    try {
      return JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as TaskCursor;
    } catch {
      throw new ApplicationError(400, 'Invalid continuation token');
    }
  }

  private hasValidSignature(payload: string, signature: string): boolean {
    const expected = this.sign(payload);
    return (
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  private sign(payload: string): string {
    return createHmac('sha256', CURSOR_SECRET)
      .update(payload)
      .digest('base64url');
  }
}
