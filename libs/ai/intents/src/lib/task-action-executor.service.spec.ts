import { OutputValidator } from '@ai-task-manager/ai/guardrails';
import { TaskActionExecutor } from './task-action-executor.service';
import {
  CategorizationFeedbackWriter,
  TaskMutationRecord,
  TaskMutationStore
} from './task-action-ports';

describe('TaskActionExecutor', () => {
  const scope = {
    orgId: 'org-root',
    userId: 'user-001',
    role: 'admin' as const,
    childOrgIds: ['org-root']
  };

  const taskRecord: TaskMutationRecord = {
    id: 'task-1000',
    title: 'Create feedback log',
    description: 'Add feedback logging',
    category: 'Analytics',
    status: 'Open',
    priority: 'High',
    createdAt: new Date('2026-04-22T00:00:00.000Z'),
    updatedAt: new Date('2026-04-22T00:00:00.000Z'),
    assignee: { id: 'user-001', name: 'Alex Rivera', role: 'Engineer' },
    org: { id: 'org-root', name: 'Acme Product' },
    tags: ['analytics'],
    activityLog: [],
    role: 'admin'
  };

  it('creates tasks and records accepted categorization feedback', async () => {
    const taskStore: TaskMutationStore = {
      create: jest.fn().mockResolvedValue(taskRecord),
      update: jest.fn(),
      delete: jest.fn()
    };
    const feedbackWriter: CategorizationFeedbackWriter = {
      recordFeedback: jest.fn().mockResolvedValue(undefined)
    };
    const executor = new TaskActionExecutor(new OutputValidator(), taskStore, feedbackWriter);

    const result = await executor.execute(
      {
        type: 'create_task',
        confidence: 0.91,
        requiresConfirmation: false,
        parameters: {
          title: 'Create feedback log',
          category: 'Analytics',
          priority: 'High',
          tags: ['analytics'],
          suggestedCategory: 'Analytics',
          suggestedPriority: 'High',
          suggestedTags: ['analytics']
        }
      },
      scope
    );

    expect(taskStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Create feedback log',
        category: 'Analytics',
        priority: 'High'
      })
    );
    expect(feedbackWriter.recordFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        taskId: 'task-1000',
        decision: 'accepted'
      })
    );
    expect(result.success).toBe(true);
  });

  it('updates tasks and records edited or rejected categorization feedback', async () => {
    const taskStore: TaskMutationStore = {
      create: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValueOnce({ ...taskRecord, id: 'task-1001', category: 'Platform' })
        .mockResolvedValueOnce({ ...taskRecord, id: 'task-1002', category: 'Operations' }),
      delete: jest.fn()
    };
    const feedbackWriter: CategorizationFeedbackWriter = {
      recordFeedback: jest.fn().mockResolvedValue(undefined)
    };
    const executor = new TaskActionExecutor(new OutputValidator(), taskStore, feedbackWriter);

    await executor.execute(
      {
        type: 'update_task',
        confidence: 0.88,
        requiresConfirmation: false,
        parameters: {
          taskId: 'task-1001',
          category: 'Platform',
          suggestedCategory: 'Analytics'
        }
      },
      scope
    );
    await executor.execute(
      {
        type: 'update_task',
        confidence: 0.88,
        requiresConfirmation: false,
        parameters: {
          taskId: 'task-1002',
          category: 'Operations',
          suggestedCategory: 'Analytics',
          categorizationDecision: 'rejected'
        }
      },
      scope
    );

    expect(taskStore.update).toHaveBeenNthCalledWith(
      1,
      'task-1001',
      expect.objectContaining({ category: 'Platform' })
    );
    expect(feedbackWriter.recordFeedback).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ taskId: 'task-1001', decision: 'edited' })
    );
    expect(feedbackWriter.recordFeedback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ taskId: 'task-1002', decision: 'rejected' })
    );
  });

  it('deletes tasks through the mutation store', async () => {
    const taskStore: TaskMutationStore = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    const feedbackWriter: CategorizationFeedbackWriter = {
      recordFeedback: jest.fn().mockResolvedValue(undefined)
    };
    const executor = new TaskActionExecutor(new OutputValidator(), taskStore, feedbackWriter);

    await executor.execute(
      {
        type: 'delete_task',
        confidence: 0.98,
        requiresConfirmation: true,
        parameters: { taskId: 'task-1003' }
      },
      scope
    );

    expect(taskStore.delete).toHaveBeenCalledWith('task-1003');
    expect(feedbackWriter.recordFeedback).not.toHaveBeenCalled();
  });
});
