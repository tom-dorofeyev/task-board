import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { User } from '../../identity/domain/user.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import { RequirePermissions } from '../../identity/presentation/route-access.decorator.js';
import { TaskService } from '../application/task.service.js';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  @RequirePermissions('tasks:read')
  list(@CurrentUser() user: User, @Query() query: Record<string, unknown>) {
    return this.tasks.list(user.id, query);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('tasks:write')
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.tasks.create(user.id, body);
  }

  @Get(':taskId')
  @RequirePermissions('tasks:read')
  get(@Param('taskId') taskId: string) {
    return this.tasks.get(taskId);
  }

  @Put(':taskId')
  @RequirePermissions('tasks:write')
  replace(@Param('taskId') taskId: string, @Body() body: unknown) {
    return this.tasks.replace(taskId, body);
  }

  @Delete(':taskId')
  @HttpCode(204)
  @RequirePermissions('tasks:write')
  async remove(@Param('taskId') taskId: string): Promise<void> {
    await this.tasks.remove(taskId);
  }

  @Post(':taskId/move')
  @HttpCode(200)
  @RequirePermissions('tasks:write')
  move(@Param('taskId') taskId: string, @Body() body: Record<string, unknown>) {
    return this.tasks.move(taskId, body);
  }
}
