import {
  calculateAcceptanceRate,
  CategorizationFeedbackRepository
} from './categorization-feedback.repository';
import { determineCategorizationDecision } from '@ai-task-manager/ai/intents';

describe('CategorizationFeedbackRepository', () => {
  it('stores feedback events and calculates acceptance rate', async () => {
    const repository = new CategorizationFeedbackRepository();

    await repository.recordFeedback({
      userId: 'user-001',
      taskId: 'task-1',
      decision: 'accepted',
      suggestedCategory: 'Platform',
      suggestedPriority: 'High',
      suggestedTags: ['backend'],
      finalCategory: 'Platform',
      finalPriority: 'High',
      finalTags: ['backend'],
      createdAt: '2026-04-22T00:00:00.000Z'
    });
    await repository.recordFeedback({
      userId: 'user-001',
      taskId: 'task-2',
      decision: 'edited',
      suggestedCategory: 'Platform',
      suggestedPriority: 'High',
      suggestedTags: ['backend'],
      finalCategory: 'Analytics',
      finalPriority: 'Medium',
      finalTags: ['analytics'],
      createdAt: '2026-04-22T00:01:00.000Z'
    });
    await repository.recordFeedback({
      userId: 'user-002',
      taskId: 'task-3',
      decision: 'rejected',
      suggestedCategory: 'Design',
      suggestedPriority: 'Low',
      suggestedTags: ['ux'],
      finalCategory: 'Operations',
      finalPriority: 'High',
      finalTags: ['ops'],
      createdAt: '2026-04-22T00:02:00.000Z'
    });

    expect(repository.list()).toHaveLength(3);
    expect(repository.getAcceptanceRate()).toBeCloseTo(1 / 3, 5);
    expect(calculateAcceptanceRate(repository.list())).toBeCloseTo(1 / 3, 5);
  });

  it('derives accepted and edited decisions when not provided explicitly', () => {
    expect(
      determineCategorizationDecision({
        suggestedCategory: 'Platform',
        suggestedPriority: 'High',
        suggestedTags: ['backend', 'api'],
        finalCategory: 'Platform',
        finalPriority: 'High',
        finalTags: ['api', 'backend']
      })
    ).toBe('accepted');

    expect(
      determineCategorizationDecision({
        suggestedCategory: 'Platform',
        suggestedPriority: 'High',
        suggestedTags: ['backend'],
        finalCategory: 'AI',
        finalPriority: 'Medium',
        finalTags: ['rag']
      })
    ).toBe('edited');
  });
});
