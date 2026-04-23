import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatHistoryService } from '../history/chat-history.service';
import { RateLimitExceededError } from '@ai-task-manager/ai/guardrails';

describe('ChatController', () => {
  const user = {
    id: 'user-001',
    orgId: 'org-root',
    orgName: 'Acme Product',
    role: 'admin' as const,
    childOrgIds: ['org-root']
  };

  let chatService: { ask: jest.Mock };
  let historyService: { list: jest.Mock };
  let controller: ChatController;

  beforeEach(() => {
    chatService = {
      ask: jest.fn().mockResolvedValue({
        answer: 'Stub answer',
        sources: [{ taskId: 'task-1', title: 'Task 1', similarity: 0.91 }],
        tokensUsed: 10,
        retrievalLatencyMs: 3
      })
    };
    historyService = {
      list: jest.fn().mockResolvedValue({ messages: [], nextCursor: null })
    };
    controller = new ChatController(
      chatService as unknown as ChatService,
      historyService as unknown as ChatHistoryService
    );
  });

  it('returns rag response for non-streaming requests', async () => {
    const response = createResponseStub();

    const result = await controller.ask({ message: 'What is blocked?' }, user, response);

    expect(result).toEqual(
      expect.objectContaining({
        answer: 'Stub answer'
      })
    );
    expect(response.setHeader).not.toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('returns HTTP 429 semantics with Retry-After when the rate limit is hit', async () => {
    chatService.ask.mockRejectedValueOnce(new RateLimitExceededError(4_200));
    const response = createResponseStub();

    await expect(controller.ask({ message: 'What is blocked?' }, user, response)).rejects.toMatchObject({
      response: { message: 'AI is busy. Please try again shortly.' },
      status: 429
    });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });

  it.skip('returns HTTP 429 and Retry-After over the real HTTP adapter', async () => {
    // Skipped in this sandbox because binding a test socket is not permitted.
  });
});

function createResponseStub() {
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn()
  };
}
