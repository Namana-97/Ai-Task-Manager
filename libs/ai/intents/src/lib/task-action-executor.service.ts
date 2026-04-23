import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ScopeFilter } from '@ai-task-manager/ai/embeddings';
import { OutputValidator } from '@ai-task-manager/ai/guardrails';
import { ActionResult, ClassifiedIntent } from './models';
import {
  CategorizationFeedbackWriter,
  determineCategorizationDecision,
  TaskMutationPayload,
  TaskMutationStore
} from './task-action-ports';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  suggestedCategory: z.string().optional(),
  suggestedPriority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  suggestedTags: z.array(z.string()).optional(),
  categorizationDecision: z.enum(['accepted', 'edited', 'rejected']).optional()
});

const updateTaskSchema = z.object({
  taskId: z.string().min(1)
});

const deleteTaskSchema = z.object({
  taskId: z.string().min(1)
});

@Injectable()
export class TaskActionExecutor {
  private readonly logger = new Logger(TaskActionExecutor.name);

  constructor(
    @Inject(OutputValidator)
    private readonly outputValidator: OutputValidator,
    @Inject(TaskMutationStore)
    private readonly taskStore: TaskMutationStore,
    @Inject(CategorizationFeedbackWriter)
    private readonly feedbackWriter: CategorizationFeedbackWriter
  ) {}

  async execute(intent: ClassifiedIntent, scope: ScopeFilter): Promise<ActionResult> {
    switch (intent.type) {
      case 'create_task': {
        const payload = this.outputValidator.validate(createTaskSchema, intent.parameters ?? {});
        const task = await this.taskStore.create(
          this.toTaskMutationPayload(payload) as TaskMutationPayload
        );
        await this.recordCategorizationFeedback(scope.userId, task.id, payload);
        this.logger.log(`Executed create_task for user=${scope.userId} title=${payload.title}`);
        return { success: true, message: `Created task "${payload.title}"`, data: task };
      }
      case 'update_task': {
        const payload = this.outputValidator.validate(
          updateTaskSchema.passthrough(),
          intent.parameters ?? {}
        );
        const { taskId, ...params } = payload;
        const task = await this.taskStore.update(payload.taskId, this.toTaskMutationPayload(params));
        await this.recordCategorizationFeedback(scope.userId, task.id, payload);
        this.logger.log(`Executed update_task for user=${scope.userId} taskId=${payload.taskId}`);
        return { success: true, message: `Updated task ${payload.taskId}`, data: task };
      }
      case 'delete_task': {
        const payload = this.outputValidator.validate(deleteTaskSchema, intent.parameters ?? {});
        await this.taskStore.delete(payload.taskId);
        this.logger.log(`Executed delete_task for user=${scope.userId} taskId=${payload.taskId}`);
        return { success: true, message: `Deleted task ${payload.taskId}` };
      }
      case 'status_report':
        return { success: true, message: 'Generated status report', data: intent.parameters };
      default:
        return { success: false, message: 'Intent execution not applicable' };
    }
  }

  private toTaskMutationPayload(input: Record<string, unknown>): Partial<TaskMutationPayload> {
    const {
      suggestedCategory: _suggestedCategory,
      suggestedPriority: _suggestedPriority,
      suggestedTags: _suggestedTags,
      categorizationDecision: _categorizationDecision,
      ...payload
    } = input;
    return payload as Partial<TaskMutationPayload>;
  }

  private async recordCategorizationFeedback(
    userId: string,
    taskId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!payload.suggestedCategory && !payload.suggestedPriority && !payload.suggestedTags) {
      return;
    }

    await this.feedbackWriter.recordFeedback({
      userId,
      taskId,
      decision: determineCategorizationDecision({
        decision: payload.categorizationDecision as 'accepted' | 'edited' | 'rejected' | undefined,
        suggestedCategory: payload.suggestedCategory as string | undefined,
        suggestedPriority: payload.suggestedPriority as
          | 'Critical'
          | 'High'
          | 'Medium'
          | 'Low'
          | undefined,
        suggestedTags: payload.suggestedTags as string[] | undefined,
        finalCategory: payload.category as string | undefined,
        finalPriority: payload.priority as 'Critical' | 'High' | 'Medium' | 'Low' | undefined,
        finalTags: payload.tags as string[] | undefined
      }),
      suggestedCategory: payload.suggestedCategory as string | undefined,
      suggestedPriority: payload.suggestedPriority as
        | 'Critical'
        | 'High'
        | 'Medium'
        | 'Low'
        | undefined,
      suggestedTags: payload.suggestedTags as string[] | undefined,
      finalCategory: payload.category as string | undefined,
      finalPriority: payload.priority as 'Critical' | 'High' | 'Medium' | 'Low' | undefined,
      finalTags: payload.tags as string[] | undefined,
      createdAt: new Date().toISOString()
    });
  }
}
