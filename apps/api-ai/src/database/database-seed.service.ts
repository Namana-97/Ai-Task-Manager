import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildSeedTasks, seedOrganizations, seedRoles, seedUsers } from './seed-data';
import { OrganizationEntity, RoleEntity, TaskEntity, UserEntity } from './entities';
import { TaskPersistenceService } from '../repository/task-persistence.service';
import { Task } from '../common/contracts';

@Injectable()
export class DatabaseSeedService {
  private seedPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @Inject(TaskPersistenceService)
    private readonly legacyTaskStore: TaskPersistenceService
  ) {}

  async ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = this.seed();
    }

    await this.seedPromise;
  }

  private async seed(): Promise<void> {
    if ((await this.roles.count()) === 0) {
      await this.roles.save(seedRoles);
    }

    if ((await this.organizations.count()) === 0) {
      await this.organizations.save(seedOrganizations);
    }

    if ((await this.users.count()) === 0) {
      await this.users.save(seedUsers);
    }

    if ((await this.tasks.count()) > 0) {
      return;
    }

    const legacyTasks = await this.loadLegacyTasks();
    const taskEntities = legacyTasks.map((task) =>
      this.tasks.create({
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        category: task.category,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        dueDate: task.dueDate ?? null,
        assigneeId: task.assignee.id,
        organizationId: task.org.id,
        tags: task.tags,
        activityLog: task.activityLog,
        visibilityRole: task.role
      })
    );
    await this.tasks.save(taskEntities);
  }

  private async loadLegacyTasks(): Promise<Task[]> {
    return this.legacyTaskStore.loadTasks(buildSeedTasks());
  }
}
