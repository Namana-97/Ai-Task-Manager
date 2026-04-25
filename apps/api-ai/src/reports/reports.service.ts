import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LlmClient } from '@ai-task-manager/ai/rag';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub,
    @Inject(LlmClient)
    private readonly llmClient: LlmClient
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
    const markdown = await renderStandupMarkdown(this.llmClient, grouped);

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

async function renderStandupMarkdown(
  llmClient: LlmClient,
  grouped: ReturnType<typeof groupStandupTasks>
): Promise<string> {
  const notes =
    grouped.unchanged.length > 0
      ? `- ${grouped.unchanged.length} open task(s) remain outside the standup sections.`
      : '- No additional notes to report at this time.';

  const baseSections = [
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

  const summary = await llmClient.complete({
    systemPrompt:
      'You are generating a concise standup summary for a secure task management system. ' +
      'Summarize completed work, in-progress work, blocked work, and the main operational takeaway. ' +
      'Use 3-4 short markdown bullet points. Do not invent tasks.',
    userMessage: JSON.stringify({
      completed: grouped.completed.map((task) => ({ id: task.id, title: task.title })),
      inProgress: grouped.started.map((task) => ({ id: task.id, title: task.title })),
      blocked: grouped.blocked.map((task) => ({ id: task.id, title: task.title })),
      notes
    })
  });

  return `${baseSections}\n\n## Summary\n${normaliseSummary(summary)}`;
}

function normaliseSummary(summary: string): string {
  const sanitised = summary
    .replace(/\r/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('* ') ? `- ${line.slice(2)}` : line))
    .join('\n');

  if (!sanitised) {
    return '- No summary available.';
  }

  if (sanitised.startsWith('- ')) {
    return sanitised;
  }

  return `- ${sanitised.replace(/\n+/g, ' ').trim()}`;
}
