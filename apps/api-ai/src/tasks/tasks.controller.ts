import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateTaskParams, AuthenticatedUser } from '../common/contracts';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const tasks = await this.tasksService.list(user);
    console.log('RETURNING TASKS:', tasks.length);
    return tasks;
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.get(id, user);
  }

  @Post()
  async create(@Body() body: CreateTaskParams) {
    return this.tasksService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateTaskParams>,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.tasksService.update(id, body, user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.tasksService.delete(id, user);
    return { success: true };
  }
}
