import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LlmClient, PromptLoader } from '@ai-task-manager/ai/rag';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub,
    @Inject(PromptLoader)
    private readonly promptLoader: PromptLoader,
    @Inject(LlmClient)
    private readonly llmClient: LlmClient
  ) {}

  async generateStandup(user: AuthenticatedUser, scope: 'personal' | 'team' = 'personal') {
    const tasks = await this.repository.findUpdatedSince(user.id, user.orgId, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const filtered =
      scope === 'personal' ? tasks.filter((task) => task.assignee.id === user.id) : tasks;
    const grouped = groupStandupTasks(filtered);
    const prompt = this.promptLoader.render('standup-report.txt', {
      userName: user.id,
      orgName: user.orgName,
      completedCount: String(grouped.completed.length),
      completedTasks: formatTaskList(grouped.completed),
      inProgressCount: String(grouped.started.length),
      inProgressTasks: formatTaskList(grouped.started),
      blockedCount: String(grouped.blocked.length),
      blockedTasks: formatTaskList(grouped.blocked)
    });
    const markdown = await this.llmClient.complete({
      systemPrompt: prompt,
      userMessage: 'Generate the standup report.'
    });

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
