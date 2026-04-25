import { Inject, Injectable } from '@nestjs/common';
import { ScopeFilter } from '@ai-task-manager/ai/embeddings';
import { RagEngine, RagResponse, SourceReference } from '@ai-task-manager/ai/rag';
import { ChatHistoryService } from '../history/chat-history.service';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';
import { ReportsService } from '../reports/reports.service';
import { QuerySessionStore } from './query-session.store';

@Injectable()
export class ChatService {
  constructor(
    @Inject(RagEngine)
    private readonly ragEngine: RagEngine,
    @Inject(ChatHistoryService)
    private readonly historyService: ChatHistoryService,
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub,
    @Inject(ReportsService)
    private readonly reportsService: ReportsService,
    @Inject(QuerySessionStore)
    private readonly sessionStore: QuerySessionStore
  ) {}

  async ask(message: string, user: AuthenticatedUser) {
    const historyPage = await this.historyService.list(user.id, 10);
    const conversationHistory = historyPage.messages
      .reverse()
      .map((entry) => ({ role: entry.role, content: entry.content, createdAt: entry.createdAt }));

    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'user',
      content: message
    });

    const scope: ScopeFilter = {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    };

    const deterministicResponse = await this.tryDeterministicResponse(message, user, scope);
    const response =
      deterministicResponse ??
      (await this.ragEngine.ask(message, scope, conversationHistory));
    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'assistant',
      content: response.answer,
      sources: response.sources
    });
    await this.captureTaskContext(user.id, response.sources);

    return response;
  }

  private async tryDeterministicResponse(
    message: string,
    user: AuthenticatedUser,
    scope: ScopeFilter
  ): Promise<RagResponse | null> {
    const normalized = message.trim().toLowerCase();

    if (/\b(standup|status report)\b/.test(normalized)) {
      const scopeMode =
        /\bpersonal\b/.test(normalized)
          ? 'personal'
          : /\bteam\b/.test(normalized) || user.role !== 'viewer'
            ? 'team'
            : 'personal';
      const report = await this.reportsService.generateStandup(user, scopeMode);
      return {
        answer: report.markdown,
        sources: [],
        tokensUsed: Math.ceil(report.markdown.length / 4),
        retrievalLatencyMs: 0
      };
    }

    const tasks = await this.repository.findAll(scope);
    if (/\b(overdue|past due)\b/.test(normalized)) {
      const overdue = tasks
        .filter((task) => task.dueDate && task.dueDate < new Date() && task.status !== 'Done')
        .sort((left, right) => left.dueDate!.getTime() - right.dueDate!.getTime());
      return this.buildTaskListResponse(
        overdue,
        overdue.length
          ? `## Overdue Tasks\n\n${overdue.length} task(s) are currently overdue.`
          : '## Overdue Tasks\n\nNo overdue tasks are currently visible in your scope.'
      );
    }

    if (
      /\b(in progress|currently in progress|tasks in progress|tasks are in progress|tasks which are in progress)\b/.test(
        normalized
      )
    ) {
      const inProgress = tasks
        .filter((task) => task.status === 'In Progress')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      return this.buildTaskListResponse(
        inProgress,
        inProgress.length
          ? `## In Progress\n\n${inProgress.length} task(s) are currently in progress.`
          : '## In Progress\n\nNo tasks are currently marked in progress.'
      );
    }

    if (/\b(pending|open tasks|tasks are pending|to do)\b/.test(normalized)) {
      const pending = tasks
        .filter((task) => ['Open', 'To Do'].includes(task.status))
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      return this.buildTaskListResponse(
        pending,
        pending.length
          ? `## Pending Tasks\n\n${pending.length} task(s) are currently pending.`
          : '## Pending Tasks\n\nNo tasks are currently pending.'
      );
    }

    if (/\b(blocked tasks|tasks are blocked|which are blocked|list all(?:\s+the)?\s+tasks\s+which\s+are\s+blocked|list all blocked tasks|show blocked tasks)\b/.test(normalized)) {
      const blocked = tasks
        .filter((task) => task.status === 'Blocked')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      return this.buildTaskListResponse(
        blocked,
        blocked.length
          ? `## Blocked Tasks\n\n${blocked.length} task(s) are currently blocked.`
          : '## Blocked Tasks\n\nNo tasks are currently blocked.'
      );
    }

    if (/\b(what did i finish last week|finished last week)\b/.test(normalized)) {
      const finished = tasks
        .filter(
          (task) =>
            task.assignee.id === user.id &&
            task.status === 'Done' &&
            task.updatedAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      return this.buildTaskListResponse(
        finished,
        finished.length
          ? '## Last Week\n\nHere is what you finished in the last 7 days.'
          : '## Last Week\n\nYou have no completed tasks in the last 7 days.'
      );
    }

    if (/\b(completed recently|finished recently|completed lately|recently completed)\b/.test(normalized)) {
      const recent = tasks
        .filter((task) => task.status === 'Done')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 6);
      return this.buildTaskListResponse(
        recent,
        recent.length
          ? '## Recently Completed\n\nThese tasks were completed most recently.'
          : '## Recently Completed\n\nNo completed tasks are available in your scope.'
      );
    }

    if (
      /\b(all(?:\s+the)?\s+completed tasks|completed tasks|done tasks|tasks are done|tasks are completed|tasks which are done|tasks which are completed|what tasks are done|what tasks are completed|list completed tasks|show completed tasks)\b/.test(
        normalized
      )
    ) {
      const completed = tasks
        .filter((task) => task.status === 'Done')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      return this.buildTaskListResponse(
        completed,
        completed.length
          ? `## Completed Tasks\n\n${completed.length} task(s) are completed.`
          : '## Completed Tasks\n\nNo completed tasks are available in your scope.'
      );
    }

    return null;
  }

  private buildTaskListResponse(tasks: Task[], heading: string): RagResponse {
    const answer = tasks.length
      ? `${heading}\n\n${tasks
          .slice(0, 6)
          .map((task) => this.formatTaskLine(task))
          .join('\n')}`
      : heading;

    return {
      answer,
      sources: tasks.slice(0, 8).map((task, index) => this.toSource(task, index)),
      tokensUsed: Math.ceil(answer.length / 4),
      retrievalLatencyMs: 0
    };
  }

  private formatTaskLine(task: Task): string {
    const due = task.dueDate ? ` due ${task.dueDate.toISOString().slice(0, 10)}` : '';
    return `- \`${task.id}\` ${task.title} — ${task.status} · ${task.category} · ${task.assignee.name}${due}`;
  }

  private toSource(task: Task, index: number): SourceReference {
    return {
      taskId: task.id,
      title: task.title,
      similarity: Math.max(0.72, 0.98 - index * 0.04)
    };
  }

  private async captureTaskContext(sessionId: string, sources?: SourceReference[]): Promise<void> {
    const taskIds = Array.from(
      new Set(
        (sources ?? [])
          .map((source) => source.taskId)
          .filter((taskId): taskId is string => Boolean(taskId))
      )
    );

    if (!taskIds.length) {
      return;
    }

    const tasks = await this.repository.findByIds(taskIds);
    if (tasks.length) {
      const ordered = taskIds
        .map((taskId) => tasks.find((task) => task.id === taskId))
        .filter((task): task is Task => Boolean(task));
      this.sessionStore.setLastTasks(sessionId, ordered);
    }
  }
}
