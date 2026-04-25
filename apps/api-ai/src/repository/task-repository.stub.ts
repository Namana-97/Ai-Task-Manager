import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ITaskRepository, Task, CreateTaskParams } from '../common/contracts';
import { TaskIndexingService } from './task-indexing.service';
import { TaskPersistenceService } from './task-persistence.service';
import { OrganizationEntity, TaskEntity, UserEntity } from '../database/entities';
import { DatabaseSeedService } from '../database/database-seed.service';
import { buildSeedTasks } from '../database/seed-data';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequestContextService } from '../common/request-context.service';

@Injectable()
export class TaskRepositoryStub implements ITaskRepository, OnModuleInit {
  private readonly logger = new Logger(TaskRepositoryStub.name);
  private tasks: Task[] = [];
  private loadingPromise: Promise<void> | null = null;
  private loaded = false;

  constructor(
    @Inject(TaskIndexingService)
    private readonly taskIndexing: TaskIndexingService,
    @Optional()
    @Inject(TaskPersistenceService)
    private readonly persistence?: TaskPersistenceService,
    @Optional()
    @InjectRepository(TaskEntity)
    private readonly taskEntities?: Repository<TaskEntity>,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly users?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(OrganizationEntity)
    private readonly organizations?: Repository<OrganizationEntity>,
    @Optional()
    @Inject(DatabaseSeedService)
    private readonly seedService?: DatabaseSeedService,
    @Optional()
    @Inject(AuditLogService)
    private readonly auditLogService?: AuditLogService,
    @Optional()
    @Inject(RequestContextService)
    private readonly requestContext?: RequestContextService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
    if (this.usesDatabase()) {
      const count = await this.taskEntities!.count();
      this.logger.log(`LOADED TASKS: ${count} from sqlite-backed TypeORM storage`);
      return;
    }

    this.logger.log(
      `LOADED TASKS: ${this.tasks.length}${this.persistence ? ` from ${this.persistence.getFilePath()}` : ' from in-memory seed'}`
    );
  }

  async seedVectorStore(): Promise<void> {
    await this.ensureLoaded();

    if (process.env.SEED_VECTOR_STORE !== 'true') {
      return;
    }

    const tasks = this.usesDatabase() ? await this.loadDbTasks() : this.tasks;
    await Promise.all(tasks.map((task) => this.taskIndexing.indexTask(task)));
  }

  async findByIds(ids: string[]): Promise<Task[]> {
    await this.ensureLoaded();
    if (!this.usesDatabase()) {
      return this.tasks.filter((task) => ids.includes(task.id));
    }

    const tasks = await this.loadDbTasks({ where: { id: In(ids) } });
    return ids
      .map((id) => tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));
  }

  async findById(
    taskId: string,
    scope?: {
      orgId: string;
      userId: string;
      role: 'viewer' | 'admin' | 'owner';
      childOrgIds?: string[];
    }
  ): Promise<Task | undefined> {
    await this.ensureLoaded();

    if (!scope) {
      if (!this.usesDatabase()) {
        return this.tasks.find((task) => task.id === taskId);
      }

      const entity = await this.taskEntities!.findOne({ where: { id: taskId } });
      return entity ? this.toTask(entity) : undefined;
    }

    const scoped = await this.findAll(scope);
    return scoped.find((task) => task.id === taskId);
  }

  async findUpdatedSince(userId: string, orgId: string, since: Date): Promise<Task[]> {
    await this.ensureLoaded();
    const tasks = this.usesDatabase() ? await this.loadDbTasks() : this.tasks;
    return tasks.filter(
      (task) =>
        task.updatedAt >= since &&
        task.org.id === orgId &&
        (task.assignee.id === userId || task.role !== 'viewer')
    );
  }

  async findAll(scope: {
    orgId: string;
    userId: string;
    role: 'viewer' | 'admin' | 'owner';
    childOrgIds?: string[];
  }): Promise<Task[]> {
    await this.ensureLoaded();
    const tasks = this.usesDatabase() ? await this.loadDbTasks() : this.tasks;
    return applyScope(tasks, scope);
  }

  async create(params: CreateTaskParams): Promise<Task> {
    await this.ensureLoaded();
    if (!this.usesDatabase()) {
      return this.createInMemory(params);
    }

    const now = new Date();
    const assignee = await this.resolveAssignee(params.assignee);
    const organization = await this.resolveOrganization(assignee);
    const entity = this.taskEntities!.create({
      id: await this.nextTaskId(),
      title: params.title,
      description: params.description ?? null,
      category: params.category ?? 'General',
      status: params.status ?? 'Open',
      priority: params.priority ?? 'Medium',
      createdAt: now,
      updatedAt: now,
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
      assigneeId: assignee.id,
      organizationId: organization.id,
      tags: params.tags ?? [],
      activityLog: [
        {
          timestamp: now.toISOString(),
          actorName: this.getActorName(),
          action: 'created task',
          details: 'Created through task mutation flow'
        }
      ],
      visibilityRole: organization.id === 'org-root' ? 'admin' : 'owner'
    });
    const saved = await this.taskEntities!.save(entity);
    const task = await this.requireTask(saved.id);
    await this.taskIndexing.indexTask(task);
    await this.auditLogService?.logTaskMutation('create', task);
    return task;
  }

  async update(taskId: string, params: Partial<CreateTaskParams>): Promise<Task> {
    await this.ensureLoaded();
    if (!this.usesDatabase()) {
      return this.updateInMemory(taskId, params);
    }

    const entity = await this.taskEntities!.findOne({ where: { id: taskId } });
    if (!entity) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (params.title !== undefined) {
      entity.title = params.title;
    }
    if (params.description !== undefined) {
      entity.description = params.description ?? null;
    }
    if (params.category !== undefined) {
      entity.category = params.category;
    }
    if (params.priority !== undefined) {
      entity.priority = params.priority;
    }
    if (params.status !== undefined) {
      entity.status = params.status;
    }
    if (params.assignee !== undefined) {
      const assignee = await this.resolveAssignee(params.assignee);
      entity.assigneeId = assignee.id;
    }
    if (params.dueDate !== undefined) {
      entity.dueDate = params.dueDate ? new Date(params.dueDate) : null;
    }
    if (params.tags !== undefined) {
      entity.tags = params.tags;
    }

    entity.updatedAt = new Date();
    entity.activityLog = [
      {
        timestamp: entity.updatedAt.toISOString(),
        actorName: this.getActorName(),
        action: 'updated task',
        details: 'Updated through task mutation flow'
      },
      ...(entity.activityLog ?? [])
    ];

    await this.taskEntities!.save(entity);
    const task = await this.requireTask(entity.id);
    await this.taskIndexing.indexTask(task);
    await this.auditLogService?.logTaskMutation('update', task);
    return task;
  }

  async delete(taskId: string): Promise<void> {
    await this.ensureLoaded();
    if (!this.usesDatabase()) {
      await this.deleteInMemory(taskId);
      return;
    }

    const task = await this.findById(taskId);
    if (!task) {
      return;
    }

    await this.taskEntities!.delete({ id: taskId });
    await this.taskIndexing.removeTask(taskId);
    await this.auditLogService?.logTaskMutation('delete', task);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.loadTasks();
    }

    await this.loadingPromise;
  }

  private async loadTasks(): Promise<void> {
    if (this.usesDatabase()) {
      await this.seedService!.ensureSeeded();
      this.loaded = true;
      return;
    }

    const seeded = buildSeedTasks();
    if (!this.persistence) {
      this.tasks = seeded;
      this.loaded = true;
      return;
    }

    this.tasks = await this.persistence.loadTasks(seeded);
    this.loaded = true;
  }

  private usesDatabase(): boolean {
    return Boolean(this.taskEntities && this.users && this.organizations && this.seedService);
  }

  private async loadDbTasks(options?: Parameters<Repository<TaskEntity>['find']>[0]): Promise<Task[]> {
    const entities = await this.taskEntities!.find(options);
    return entities.map((entity) => this.toTask(entity));
  }

  private toTask(entity: TaskEntity): Task {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description ?? undefined,
      category: entity.category,
      status: entity.status,
      priority: entity.priority,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
      dueDate: entity.dueDate ? new Date(entity.dueDate) : undefined,
      assignee: {
        id: entity.assignee.id,
        name: entity.assignee.displayName,
        role: entity.assignee.jobTitle
      },
      org: {
        id: entity.organization.id,
        name: entity.organization.name
      },
      tags: entity.tags ?? [],
      activityLog: entity.activityLog ?? [],
      role: entity.visibilityRole
    };
  }

  private async resolveAssignee(rawAssignee?: string): Promise<UserEntity> {
    const preferred = rawAssignee?.trim().toLowerCase();
    const currentUserId = this.requestContext?.getUser()?.id;
    if (preferred) {
      const users = await this.users!.find();
      const matched = users.find(
        (user) =>
          user.id.toLowerCase() === preferred ||
          user.username.toLowerCase() === preferred ||
          user.displayName.toLowerCase() === preferred
      );
      if (matched) {
        return matched;
      }
    }

    if (currentUserId) {
      const current = await this.users!.findOne({ where: { id: currentUserId } });
      if (current) {
        return current;
      }
    }

    return this.users!.findOneOrFail({ where: { id: 'user-001' } });
  }

  private async resolveOrganization(assignee: UserEntity): Promise<OrganizationEntity> {
    const currentUserId = this.requestContext?.getUser()?.id;
    if (currentUserId) {
      const current = await this.users!.findOne({ where: { id: currentUserId } });
      if (current?.organizationId) {
        return this.organizations!.findOneByOrFail({ id: current.organizationId });
      }
    }

    return this.organizations!.findOneByOrFail({ id: assignee.organizationId });
  }

  private async nextTaskId(): Promise<string> {
    if (!this.usesDatabase()) {
      return nextTaskId(this.tasks.map((task) => task.id));
    }

    const tasks = await this.taskEntities!.find({ select: { id: true } as never });
    return nextTaskId(tasks.map((task) => task.id));
  }

  private async requireTask(taskId: string): Promise<Task> {
    const task = await this.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return task;
  }

  private getActorName(): string {
    return this.requestContext?.getUser()?.name ?? this.requestContext?.getUser()?.username ?? 'AI Assistant';
  }

  private async createInMemory(params: CreateTaskParams): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: nextTaskId(this.tasks.map((entry) => entry.id)),
      title: params.title,
      description: params.description,
      category: params.category ?? 'General',
      status: params.status ?? 'Open',
      priority: params.priority ?? 'Medium',
      createdAt: now,
      updatedAt: now,
      dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
      assignee: { id: 'user-001', name: params.assignee ?? 'Alex Rivera', role: 'Engineer' },
      org: { id: 'org-root', name: 'Acme Product' },
      tags: params.tags ?? [],
      activityLog: [
        {
          timestamp: now.toISOString(),
          actorName: 'AI Assistant',
          action: 'created task',
          details: 'Created through task mutation flow'
        }
      ],
      role: 'admin'
    };
    this.tasks.unshift(task);
    await this.persistence?.saveTasks(this.tasks);
    await this.taskIndexing.indexTask(task);
    return task;
  }

  private async updateInMemory(taskId: string, params: Partial<CreateTaskParams>): Promise<Task> {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (params.title !== undefined) task.title = params.title;
    if (params.description !== undefined) task.description = params.description;
    if (params.category !== undefined) task.category = params.category;
    if (params.priority !== undefined) task.priority = params.priority;
    if (params.status !== undefined) task.status = params.status;
    if (params.assignee !== undefined) task.assignee = { ...task.assignee, name: params.assignee };
    if (params.dueDate !== undefined) task.dueDate = params.dueDate ? new Date(params.dueDate) : undefined;
    if (params.tags !== undefined) task.tags = params.tags;

    task.updatedAt = new Date();
    task.activityLog.unshift({
      timestamp: task.updatedAt.toISOString(),
      actorName: 'AI Assistant',
      action: 'updated task',
      details: 'Updated through task mutation flow'
    });
    await this.persistence?.saveTasks(this.tasks);
    await this.taskIndexing.indexTask(task);
    return task;
  }

  private async deleteInMemory(taskId: string): Promise<void> {
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) {
      this.tasks.splice(index, 1);
      await this.persistence?.saveTasks(this.tasks);
      await this.taskIndexing.removeTask(taskId);
    }
  }
}

function applyScope(
  tasks: Task[],
  scope: { orgId: string; userId: string; role: 'viewer' | 'admin' | 'owner'; childOrgIds?: string[] }
): Task[] {
  if (scope.role === 'viewer') {
    return tasks.filter(
      (task) => task.org.id === scope.orgId && task.assignee.id === scope.userId
    );
  }
  if (scope.role === 'admin') {
    return tasks.filter((task) => task.org.id === scope.orgId);
  }
  const orgIds = scope.childOrgIds?.length ? scope.childOrgIds : [scope.orgId];
  return tasks.filter((task) => orgIds.includes(task.org.id));
}

function nextTaskId(ids: string[]): string {
  const max = ids.reduce((highest, id) => {
    const parsed = Number(id.replace(/^task-/, ''));
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0);

  return `task-${String(max + 1).padStart(4, '0')}`;
}
