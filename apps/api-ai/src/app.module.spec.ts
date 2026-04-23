import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { IntentsController } from './intents/intents.controller';
import { ChatController } from './chat/chat.controller';

describe('AppModule runtime wiring', () => {
  it('resolves the app controllers and their live dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const intentsController = moduleRef.get(IntentsController);
    const chatController = moduleRef.get(ChatController);

    expect(intentsController).toBeInstanceOf(IntentsController);
    expect(chatController).toBeInstanceOf(ChatController);
  });

  it('executes a create-task intent through the live container', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const intentsController = moduleRef.get(IntentsController);
    const result = await intentsController.execute(
      {
        intent: {
          type: 'create_task',
          confidence: 0.99,
          requiresConfirmation: false,
          parameters: {
            title: 'Container wiring task',
            category: 'Analytics',
            priority: 'High',
            tags: ['container', 'wiring'],
            suggestedCategory: 'Analytics',
            suggestedPriority: 'High',
            suggestedTags: ['container', 'wiring']
          }
        }
      },
      {
        id: 'user-001',
        orgId: 'org-root',
        orgName: 'Acme Product',
        role: 'admin',
        childOrgIds: ['org-root']
      }
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('Created task');
  });
});
