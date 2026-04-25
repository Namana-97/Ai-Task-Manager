import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ITaskRepository, Task, CreateTaskParams } from '../common/contracts';
import { TaskIndexingService } from './task-indexing.service';
import { TaskPersistenceService } from './task-persistence.service';

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
    private readonly persistence?: TaskPersistenceService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
    this.logger.log(
      `LOADED TASKS: ${this.tasks.length}${this.persistence ? ` from ${this.persistence.getFilePath()}` : ' from in-memory seed'}`
    );
  }

  async seedVectorStore(): Promise<void> {
    await this.ensureLoaded();

    if (process.env.SEED_VECTOR_STORE !== 'true') {
      return;
    }

    await Promise.all(this.tasks.map((task) => this.taskIndexing.indexTask(task)));
  }

  async findByIds(ids: string[]): Promise<Task[]> {
    await this.ensureLoaded();
    return this.tasks.filter((task) => ids.includes(task.id));
  }

  async findById(
    taskId: string,
    scope?: { orgId: string; userId: string; role: 'viewer' | 'admin' | 'owner'; childOrgIds?: string[] }
  ): Promise<Task | undefined> {
    await this.ensureLoaded();

    if (!scope) {
      return this.tasks.find((task) => task.id === taskId);
    }

    const scoped = await this.findAll(scope);
    return scoped.find((task) => task.id === taskId);
  }

  async findUpdatedSince(userId: string, orgId: string, since: Date): Promise<Task[]> {
    await this.ensureLoaded();
    return this.tasks.filter(
      (task) =>
        task.updatedAt >= since &&
        task.org.id === orgId &&
        (task.assignee.id === userId || task.role !== 'viewer')
    );
  }

  async findAll(scope: { orgId: string; userId: string; role: 'viewer' | 'admin' | 'owner'; childOrgIds?: string[] }): Promise<Task[]> {
    await this.ensureLoaded();
    if (scope.role === 'viewer') {
      return this.tasks.filter((task) => task.org.id === scope.orgId && task.assignee.id === scope.userId);
    }
    if (scope.role === 'admin') {
      return this.tasks.filter((task) => task.org.id === scope.orgId);
    }
    const orgIds = scope.childOrgIds?.length ? scope.childOrgIds : [scope.orgId];
    return this.tasks.filter((task) => orgIds.includes(task.org.id));
  }

  async create(params: CreateTaskParams): Promise<Task> {
    await this.ensureLoaded();
    const now = new Date();
    const task: Task = {
      id: nextTaskId(this.tasks),
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
    await this.persistTasks();
    await this.taskIndexing.indexTask(task);
    return task;
  }

  async update(taskId: string, params: Partial<CreateTaskParams>): Promise<Task> {
    await this.ensureLoaded();
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (params.title !== undefined) {
      task.title = params.title;
    }
    if (params.description !== undefined) {
      task.description = params.description;
    }
    if (params.category !== undefined) {
      task.category = params.category;
    }
    if (params.priority !== undefined) {
      task.priority = params.priority;
    }
    if (params.status !== undefined) {
      task.status = params.status;
    }
    if (params.assignee !== undefined) {
      task.assignee = { ...task.assignee, name: params.assignee };
    }
    if (params.dueDate !== undefined) {
      task.dueDate = params.dueDate ? new Date(params.dueDate) : undefined;
    }
    if (params.tags !== undefined) {
      task.tags = params.tags;
    }

    task.updatedAt = new Date();
    task.activityLog.unshift({
      timestamp: task.updatedAt.toISOString(),
      actorName: 'AI Assistant',
      action: 'updated task',
      details: 'Updated through task mutation flow'
    });
    await this.persistTasks();
    await this.taskIndexing.indexTask(task);
    return task;
  }

  async delete(taskId: string): Promise<void> {
    await this.ensureLoaded();
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) {
      this.tasks.splice(index, 1);
      await this.persistTasks();
      await this.taskIndexing.removeTask(taskId);
    }
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
    const seeded = seedTasks();
    if (!this.persistence) {
      this.tasks = seeded;
      this.loaded = true;
      return;
    }

    this.tasks = await this.persistence.loadTasks(seeded);
    this.loaded = true;
  }

  private async persistTasks(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    await this.persistence.saveTasks(this.tasks);
  }
}

function nextTaskId(tasks: Task[]): string {
  const max = tasks.reduce((highest, task) => {
    const parsed = Number(task.id.replace(/^task-/, ''));
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0);

  return `task-${String(max + 1).padStart(4, '0')}`;
}

function seedTasks(): Task[] {
  const now = new Date('2026-04-22T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const users = [
    { id: 'user-001', name: 'Alex Rivera', role: 'Frontend Lead' },
    { id: 'user-002', name: 'Jordan Lee', role: 'Backend Engineer' },
    { id: 'user-003', name: 'Taylor Kim', role: 'Product Manager' },
    { id: 'user-004', name: 'Morgan Patel', role: 'QA Engineer' }
  ];
  const orgs = [
    { id: 'org-root', name: 'Acme Product' },
    { id: 'org-design', name: 'Acme Design' }
  ];

  const specs = [
    ['task-0001', 'Fix sprint burndown chart timezone drift', 'Analytics', 'In Progress', users[1], orgs[0], 3],
    ['task-0002', 'Prepare Q2 roadmap review deck', 'Planning', 'Done', users[2], orgs[0], 1],
    ['task-0003', 'Investigate flaky websocket reconnect test', 'Platform', 'Blocked', users[3], orgs[0], 6],
    ['task-0004', 'Refine onboarding checklist for enterprise trial', 'Operations', 'Open', users[2], orgs[0], 4],
    ['task-0005', 'Ship keyboard navigation for task drawer', 'UX', 'Done', users[0], orgs[0], 2],
    ['task-0006', 'Reduce API p95 latency for /tasks/search', 'Platform', 'In Progress', users[1], orgs[0], 16],
    ['task-0007', 'Backfill audit logs for overdue task escalations', 'Compliance', 'Open', users[1], orgs[0], 7],
    ['task-0008', 'Design blocked-state empty view', 'Design', 'In Progress', users[0], orgs[1], 8],
    ['task-0009', 'Create regression suite for recurring tasks', 'QA', 'Done', users[3], orgs[0], 2],
    ['task-0010', 'Resolve SSO callback mismatch for sandbox orgs', 'Security', 'Blocked', users[1], orgs[0], 10],
    ['task-0011', 'Tune notification digest batching job', 'Platform', 'Done', users[1], orgs[0], 5],
    ['task-0012', 'Document RBAC edge cases for support', 'Support', 'Open', users[2], orgs[0], 9],
    ['task-0013', 'Patch stale Prisma migration in demo seed path', 'Infrastructure', 'In Progress', users[1], orgs[0], 15],
    ['task-0014', 'Polish mobile task details drawer spacing', 'UX', 'Done', users[0], orgs[0], 1],
    ['task-0015', 'Audit third-party webhook retries', 'Security', 'In Progress', users[3], orgs[0], 12],
    ['task-0016', 'Write release notes for April sprint closeout', 'Planning', 'Open', users[2], orgs[0], 0],
    ['task-0017', 'Investigate overdue cluster in customer migration tasks', 'Operations', 'Blocked', users[2], orgs[0], 17],
    ['task-0018', 'Improve semantic search relevance sampling', 'AI', 'In Progress', users[1], orgs[0], 4],
    ['task-0019', 'Sync design tokens with shell preview app', 'Design', 'Done', users[0], orgs[1], 3],
    ['task-0020', 'Add post-release anomaly dashboard drilldowns', 'Analytics', 'Open', users[2], orgs[0], 14]
  ] as const;

  return specs.map(([id, title, category, status, assignee, org, ageDays], index) => ({
    id,
    title,
    description: `${title} with production-grade follow-through for the AI task management submission.`,
    category,
    status,
    priority: (['Critical', 'High', 'Medium', 'Low'][index % 4] as Task['priority']),
    createdAt: daysAgo(ageDays + 2),
    updatedAt: daysAgo(Math.max(ageDays - 1, 0)),
    dueDate: daysAgo(ageDays - 3),
    assignee,
    org,
    tags: [category.toLowerCase(), status.toLowerCase().replace(/\s+/g, '-')],
    role: org.id === 'org-root' ? 'admin' : 'owner',
    activityLog: [
      {
        timestamp: daysAgo(ageDays + 1).toISOString(),
        actorName: assignee.name,
        action: 'created task',
        details: 'Initial triage completed'
      },
      {
        timestamp: daysAgo(Math.max(ageDays - 1, 0)).toISOString(),
        actorName: 'System',
        action: `moved to ${status}`,
        details: 'Workflow automation sync'
      }
    ]
  }));
}
