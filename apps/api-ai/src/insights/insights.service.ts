import { Inject, Injectable } from '@nestjs/common';
import { LlmClient, PromptLoader } from '@ai-task-manager/ai/rag';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';

export interface Insight {
  type: 'stale_task' | 'throughput_drop' | 'productivity_pattern' | 'overdue_cluster';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  taskIds: string[];
  metric?: {
    label: string;
    current: number;
    baseline: number;
    unit: string;
  };
}

interface DetectedAnomaly {
  type: Insight['type'];
  severity: Insight['severity'];
  taskIds: string[];
  stats: Record<string, unknown>;
  metric?: Insight['metric'];
}

@Injectable()
export class InsightsService {
  private readonly cache = new Map<string, { expiresAt: number; insights: Insight[] }>();

  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub,
    @Inject(PromptLoader)
    private readonly promptLoader: PromptLoader,
    @Inject(LlmClient)
    private readonly llmClient: LlmClient
  ) {}

  async getInsights(user: AuthenticatedUser): Promise<{ insights: Insight[]; generatedAt: string }> {
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const cacheKey = `${user.id}:${bucket}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { insights: cached.insights, generatedAt: new Date().toISOString() };
    }

    const tasks = await this.repository.findAll({
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    });
    const anomalies = [
      ...detectStaleTasks(tasks),
      ...detectThroughputDrop(tasks),
      ...detectOverdueClusters(tasks),
      ...detectProductivityPattern(tasks)
    ];

    const insights = await Promise.all(
      anomalies.map(async (anomaly) => ({
        type: anomaly.type,
        severity: anomaly.severity,
        taskIds: anomaly.taskIds,
        metric: anomaly.metric,
        message: await this.llmClient.complete({
          systemPrompt: this.promptLoader.render('anomaly-insights.txt', {
            anomalyType: anomaly.type,
            anomalyData: JSON.stringify(anomaly.stats)
          }),
          userMessage: 'Write the insight.'
        })
      }))
    );

    this.cache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, insights });
    return { insights, generatedAt: new Date().toISOString() };
  }
}

export function detectStaleTasks(tasks: Task[]): DetectedAnomaly[] {
  const threshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const staleTasks = tasks.filter(
    (task) => task.status === 'In Progress' && task.updatedAt.getTime() < threshold
  );
  return staleTasks.length
    ? [
        {
          type: 'stale_task',
          severity: staleTasks.length > 2 ? 'critical' : 'warning',
          taskIds: staleTasks.map((task) => task.id),
          stats: { count: staleTasks.length, titles: staleTasks.map((task) => task.title) }
        }
      ]
    : [];
}

export function detectThroughputDrop(tasks: Task[]): DetectedAnomaly[] {
  const now = new Date('2026-04-22T12:00:00.000Z');
  const startOfWeek = new Date('2026-04-20T00:00:00.000Z');
  const previousWeek = new Date('2026-04-13T00:00:00.000Z');
  const completedThisWeek = tasks.filter(
    (task) => task.status === 'Done' && task.updatedAt >= startOfWeek && task.updatedAt <= now
  ).length;
  const completedLastWeek = tasks.filter(
    (task) => task.status === 'Done' && task.updatedAt >= previousWeek && task.updatedAt < startOfWeek
  ).length;
  const drop = completedLastWeek === 0 ? 0 : (completedLastWeek - completedThisWeek) / completedLastWeek;
  return drop > 0.25
    ? [
        {
          type: 'throughput_drop',
          severity: drop > 0.5 ? 'critical' : 'warning',
          taskIds: [],
          stats: { completedThisWeek, completedLastWeek, dropPct: Math.round(drop * 100) },
          metric: {
            label: 'Tasks completed',
            current: completedThisWeek,
            baseline: completedLastWeek,
            unit: 'tasks'
          }
        }
      ]
    : [];
}

export function detectOverdueClusters(tasks: Task[]): DetectedAnomaly[] {
  const overdue = tasks.filter(
    (task) => task.dueDate && task.dueDate.getTime() < Date.now() && task.status !== 'Done'
  );
  const grouped = overdue.reduce<Record<string, Task[]>>((acc, task) => {
    acc[task.category] = acc[task.category] ?? [];
    acc[task.category].push(task);
    return acc;
  }, {});
  return Object.entries(grouped)
    .filter(([, groupedTasks]) => groupedTasks.length >= 3)
    .map(([category, groupedTasks]) => ({
      type: 'overdue_cluster' as const,
      severity: groupedTasks.length >= 5 ? 'critical' : 'warning',
      taskIds: groupedTasks.map((task) => task.id),
      stats: { category, count: groupedTasks.length }
    }));
}

export function detectProductivityPattern(tasks: Task[]): DetectedAnomaly[] {
  const completions = tasks
    .filter((task) => task.status === 'Done')
    .reduce<Record<string, number>>((acc, task) => {
      const key = task.updatedAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const values = Object.values(completions);
  if (!values.length) {
    return [];
  }
  const current = values[values.length - 1];
  const baseline = values.reduce((sum, value) => sum + value, 0) / values.length;
  return current < baseline * 0.75
    ? [
        {
          type: 'productivity_pattern',
          severity: 'info',
          taskIds: [],
          stats: { current, baseline: Number(baseline.toFixed(2)) },
          metric: {
            label: 'Daily completions',
            current,
            baseline: Number(baseline.toFixed(2)),
            unit: 'tasks/day'
          }
        }
      ]
    : [];
}
