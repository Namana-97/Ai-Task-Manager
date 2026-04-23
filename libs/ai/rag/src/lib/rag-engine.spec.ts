import { RagEngine } from './rag-engine.service';
import {
  AuditLogger,
  CanaryTokenValidator,
  InputSanitiser
} from '@ai-task-manager/ai/guardrails';
import { PromptLoader } from './prompt-loader.service';

describe('RagEngine', () => {
  it('constructs a response with sources from retrieved documents', async () => {
    const engine = new RagEngine(
      new InputSanitiser(),
      new CanaryTokenValidator(),
      { embed: jest.fn().mockResolvedValue([[0.1, 0.2]]) } as never,
      {
        search: jest.fn().mockResolvedValue([
          {
            id: 'task-0001',
            similarity: 0.91,
            metadata: { title: 'Fix login flow', orgName: 'Acme Product' },
            document: '[Title]: Fix login flow'
          }
        ])
      } as never,
      new PromptLoader(),
      { complete: jest.fn().mockResolvedValue('Answer citing [task-0001].') } as never,
      {
        logLlmInteraction: jest.fn(),
        hash: jest.fn().mockReturnValue('hash')
      } as unknown as AuditLogger
    );

    const response = await engine.ask(
      'What is blocked?',
      { orgId: 'org-root', userId: 'user-1', role: 'admin' },
      []
    );

    expect(response.answer).toContain('task-0001');
    expect(response.sources[0]?.taskId).toBe('task-0001');
  });
});
