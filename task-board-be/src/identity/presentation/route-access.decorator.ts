import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../domain/permission.js';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
