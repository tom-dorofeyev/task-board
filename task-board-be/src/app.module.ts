import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module.js';
import { ApplicationErrorFilter } from './shared/http/application-error.filter.js';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [IdentityModule, TasksModule],
  providers: [{ provide: APP_FILTER, useClass: ApplicationErrorFilter }],
})
export class AppModule {}
