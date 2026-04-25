import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { IntentsController } from './intents.controller';

describe('IntentsController', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.SEED_VECTOR_STORE = 'false';
  });

  it('blocks viewers from executing create_task intents', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(IntentsController);
    const viewer = await authService.buildAuthenticatedUser('user-001');

    await expect(
      controller.execute(
        {
          intent: {
            type: 'create_task',
            confidence: 0.99,
            parameters: {
              title: 'Viewer intent mutation'
            },
            requiresConfirmation: false
          }
        },
        viewer
      )
    ).rejects.toMatchObject({
      status: 403
    });
  });

  it('allows admins to execute create_task intents', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(IntentsController);
    const admin = await authService.buildAuthenticatedUser('user-002');

    const result = await controller.execute(
      {
        intent: {
          type: 'create_task',
          confidence: 0.99,
          parameters: {
            title: 'Admin intent mutation',
            category: 'Security'
          },
          requiresConfirmation: false
        }
      },
      admin
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Created task "Admin intent mutation"'
      })
    );
  });

  it('returns a no-updates message for incomplete update intents instead of failing authorization', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(IntentsController);
    const admin = await authService.buildAuthenticatedUser('user-002');

    const result = await controller.execute(
      {
        intent: {
          type: 'update_task',
          confidence: 0.99,
          parameters: {
            taskId: 'task-0003'
          },
          requiresConfirmation: false
        }
      },
      admin
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message: 'No updates were provided for task task-0003'
      })
    );
  });
});
