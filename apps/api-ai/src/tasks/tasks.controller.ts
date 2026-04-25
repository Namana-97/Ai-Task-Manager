import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CreateTaskParams, AuthenticatedUser } from '../common/contracts';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { RbacGuard } from '../auth/rbac.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/access-control';
import { Roles } from '../auth/roles.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TasksController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService
  ) {}

  @Get()
  @Permissions(Permission.TaskRead)
  async list(@CurrentUser() user: AuthenticatedUser) {
    const tasks = await this.tasksService.list(user);
    console.log('RETURNING TASKS:', tasks.length);
    return tasks;
  }

  @Get(':id')
  @Permissions(Permission.TaskRead)
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.get(id, user);
  }

  @Post()
  @Roles('owner', 'admin')
  @Permissions(Permission.TaskCreate)
  async create(@Body() body: CreateTaskParams, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.create(body, user);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  @Permissions(Permission.TaskUpdate)
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateTaskParams>,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.tasksService.update(id, body, user);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @Permissions(Permission.TaskDelete)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.tasksService.delete(id, user);
    return { success: true };
  }
}
