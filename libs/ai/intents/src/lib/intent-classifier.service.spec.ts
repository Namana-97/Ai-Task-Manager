import { AnthropicIntentClassifier } from './intent-classifier.service';

describe('AnthropicIntentClassifier', () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = 'disabled';
  });

  it('parses status updates phrased as "update the status of the task-xxxx to blocked"', async () => {
    const classifier = new AnthropicIntentClassifier(
      { load: jest.fn().mockReturnValue('') } as never,
      { validate: jest.fn((_: unknown, value: unknown) => value) } as never,
      { hasKeys: jest.fn().mockReturnValue(false) } as never
    );

    const intent = await classifier.classify(
      'update the status of the task-0023 to blocked',
      []
    );

    expect(intent).toEqual({
      type: 'update_task',
      confidence: 0.96,
      parameters: {
        taskId: 'task-0023',
        status: 'Blocked'
      },
      requiresConfirmation: true
    });
  });
});
