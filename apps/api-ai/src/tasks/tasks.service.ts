import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskParams, Task, AuthenticatedUser } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';

@Injectable()
export class TasksService {
  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub
  ) {}

  async list(user: AuthenticatedUser): Promise<Task[]> {
    return this.repository.findAll({
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    });
  }

  async get(taskId: string, user: AuthenticatedUser): Promise<Task> {
    const task = await this.repository.findById(taskId, {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    });

    if (!task) {
      throw new NotFoundException(`Task not found: ${taskId}`);
    }

    return task;
  }

  async create(input: CreateTaskParams, user: AuthenticatedUser): Promise<Task> {
    if (user.role === 'viewer') {
      throw new ForbiddenException('Task creation is not permitted');
    }
    return this.repository.create(input);
  }

  async update(taskId: string, input: Partial<CreateTaskParams>, user: AuthenticatedUser): Promise<Task> {
    await this.get(taskId, user);
    return this.repository.update(taskId, input);
  }

  async delete(taskId: string, user: AuthenticatedUser): Promise<void> {
    await this.get(taskId, user);
    await this.repository.delete(taskId);
  }
}
