import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { HmacTaskCursorCodec } from './infrastructure/hmac-task-cursor-codec.js';
import { InMemoryTaskRepository } from './infrastructure/in-memory-task-repository.js';
import { MongoTaskRepository } from './infrastructure/mongo-task-repository.js';
import { RandomTaskIdGenerator } from './infrastructure/random-task-id-generator.js';
import { TASK_CURSOR_CODEC } from './application/task-cursor-codec.js';
import { TASK_ID_GENERATOR } from './application/task-id-generator.js';
import { TASK_REPOSITORY } from './application/task-repository.js';
import { TaskService } from './application/task.service.js';
import { TasksController } from './presentation/tasks.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [TasksController],
  providers: [
    {
      provide: TASK_REPOSITORY,
      useFactory: () => {
        const uri = process.env.TASK_BOARD_MONGODB_URI;
        return uri
          ? MongoTaskRepository.connect(uri)
          : new InMemoryTaskRepository();
      },
    },
    { provide: TASK_CURSOR_CODEC, useValue: new HmacTaskCursorCodec() },
    { provide: TASK_ID_GENERATOR, useValue: new RandomTaskIdGenerator() },
    {
      provide: TaskService,
      useFactory: (repository, cursorCodec, taskIds) =>
        new TaskService(repository, cursorCodec, taskIds),
      inject: [TASK_REPOSITORY, TASK_CURSOR_CODEC, TASK_ID_GENERATOR],
    },
  ],
})
export class TasksModule {}
