import type { Request } from 'express';
import type { User } from '../domain/user.js';

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: User;
  sessionToken?: string;
}
