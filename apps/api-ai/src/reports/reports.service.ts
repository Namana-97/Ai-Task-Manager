import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub
  ) {}

  async generateStandup(user: AuthenticatedUser, scope: 'personal' | 'team' = 'personal') {
    const tasks = await this.repository.findUpdatedSince(
      user.id,
      user.orgId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const filtered =
      scope === 'personal' ? tasks.filter((task) => task.assignee.id === user.id) : tasks;
    const grouped = groupStandupTasks(filtered);
    const markdown = renderStandupMarkdown(grouped);

    return {
      markdown,
      generatedAt: new Date().toISOString(),
      taskCount: filtered.length
    };
  }

  @Cron('0 9 * * 1-5')
  async runDailyStandup(): Promise<void> {
    if (process.env.ENABLE_STANDUP_CRON !== 'true') {
      return;
    }
    this.logger.log('Would send standup to 4 users');
  }
}

function groupStandupTasks(tasks: Task[]) {
  return {
    completed: tasks.filter((task) => task.status === 'Done'),
    started: tasks.filter((task) => task.status === 'In Progress'),
    blocked: tasks.filter((task) => task.status === 'Blocked'),
    unchanged: tasks.filter((task) => !['Done', 'In Progress', 'Blocked'].includes(task.status))
  };
}

function formatTaskList(tasks: Task[]): string {
  return tasks.map((task) => `- ${task.title} (${task.id})`).join('\n') || '- None';
}

function renderStandupMarkdown(grouped: ReturnType<typeof groupStandupTasks>): string {
  const notes =
    grouped.unchanged.length > 0
      ? `- ${grouped.unchanged.length} open task(s) remain outside the standup sections.`
      : '- No additional notes to report at this time.';

  return [
    '## Done',
    formatTaskList(grouped.completed),
    '',
    '## In Progress',
    formatTaskList(grouped.started),
    '',
    '## Blocked',
    formatTaskList(grouped.blocked),
    '',
    '## Notes',
    notes
  ].join('\n');
}
