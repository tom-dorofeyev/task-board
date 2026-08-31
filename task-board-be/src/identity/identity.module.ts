import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationService } from './application/authentication.service.js';
import { AuthorizationService } from './application/authorization.service.js';
import {
  IDENTITY_STORE,
  type IdentityStore,
} from './application/identity-store.js';
import { InMemoryIdentityStore } from './infrastructure/in-memory-identity-store.js';
import { AuthController } from './presentation/auth.controller.js';
import { AuthenticationGuard } from './presentation/authentication.guard.js';
import { AuthorizationGuard } from './presentation/authorization.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    InMemoryIdentityStore,
    { provide: IDENTITY_STORE, useExisting: InMemoryIdentityStore },
    {
      provide: AuthenticationService,
      useFactory: (identityStore: IdentityStore) =>
        new AuthenticationService(identityStore),
      inject: [IDENTITY_STORE],
    },
    { provide: AuthorizationService, useValue: new AuthorizationService() },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [AuthenticationService],
})
export class IdentityModule {}
