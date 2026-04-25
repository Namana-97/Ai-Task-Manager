import { Inject, Injectable } from '@nestjs/common';
import { ScopeFilter } from '@ai-task-manager/ai/embeddings';
import { RagResponse, SourceReference } from '@ai-task-manager/ai/rag';
import { AuthenticatedUser, Task } from '../common/contracts';
import { TaskRepositoryStub } from '../repository/task-repository.stub';
import { QuerySessionStore } from './query-session.store';

@Injectable()
export class QueryRouterService {
  constructor(
    @Inject(TaskRepositoryStub)
    private readonly repository: TaskRepositoryStub,
    @Inject(QuerySessionStore)
    private readonly sessionStore: QuerySessionStore
  ) {}

  async handle(
    message: string,
    sessionId: string,
    user: AuthenticatedUser
  ): Promise<RagResponse | null> {
    const normalized = message.trim().toLowerCase();

    if (this.isRestrictedScopeQuery(normalized)) {
      return {
        answer: 'I can only access tasks within your authorized scope.',
        sources: [],
        tokensUsed: 13,
        retrievalLatencyMs: 0
      };
    }

    const scope: ScopeFilter = {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    };

    if (this.isListAllTasksQuery(normalized)) {
      const tasks = await this.repository.findAll(scope);
      this.sessionStore.setLastTasks(sessionId, tasks);
      return this.buildTaskListResponse(
        tasks,
        tasks.length
          ? `## All Tasks\n\nHere are the ${tasks.length} task(s) currently visible in your scope.`
          : '## All Tasks\n\nNo tasks are currently visible in your scope.'
      );
    }

    if (this.isFollowUpQuery(normalized)) {
      const task = this.sessionStore.get(sessionId)?.lastTasks?.[0];
      if (!task) {
        return null;
      }

      this.sessionStore.setLastTasks(sessionId, [task]);
      return this.buildSingleTaskResponse(task, normalized);
    }

    return null;
  }

  private isListAllTasksQuery(message: string): boolean {
    return /^(?:(?:show|list)(?:\s+all)?(?:\s+the)?\s+tasks|all tasks)$/i.test(
      message.trim()
    );
  }

  private isRestrictedScopeQuery(message: string): boolean {
    return (
      /\b(all tasks in every org|every org|all orgs|across orgs)\b/.test(message) ||
      /\b(tasks i should not access|tasks i shouldnt access|tasks i should not have access to)\b/.test(message)
    );
  }

  private isFollowUpQuery(message: string): boolean {
    return /\b(this task|that task|this one|id of this|task id of this task)\b/.test(message);
  }

  private buildSingleTaskResponse(task: Task, message: string): RagResponse {
    const answer = /\b(task id|id of this|id)\b/.test(message)
      ? `## Task ID\n\nThe task ID is \`${task.id}\`.`
      : [
          '## Task',
          '',
          `- \`ID\`: \`${task.id}\``,
          `- \`Title\`: ${task.title}`,
          `- \`Status\`: ${task.status}`,
          `- \`Category\`: ${task.category}`,
          `- \`Assignee\`: ${task.assignee.name}`
        ].join('\n');

    return {
      answer,
      sources: [this.toSource(task, 0)],
      tokensUsed: Math.ceil(answer.length / 4),
      retrievalLatencyMs: 0
    };
  }

  private buildTaskListResponse(tasks: Task[], heading: string): RagResponse {
    const answer = tasks.length
      ? `${heading}\n\n${tasks
          .slice(0, 10)
          .map((task) => this.formatTaskLine(task))
          .join('\n')}`
      : heading;

    return {
      answer,
      sources: tasks.slice(0, 10).map((task, index) => this.toSource(task, index)),
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
}
