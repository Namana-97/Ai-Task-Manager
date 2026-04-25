import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.SEED_VECTOR_STORE = 'false';
  });

  it('scopes viewer task access to assigned org tasks', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(TasksController);
    const viewer = await authService.buildAuthenticatedUser('user-001');
    const tasks = await controller.list(viewer);

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.assignee.id === viewer.id)).toBe(true);
    expect(tasks.every((task) => task.org.id === viewer.orgId)).toBe(true);
  });

  it('prevents viewers from creating tasks', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(TasksController);
    const viewer = await authService.buildAuthenticatedUser('user-001');

    await expect(
      controller.create(
        {
          title: 'Viewer mutation attempt',
          category: 'Security'
        },
        viewer
      )
    ).rejects.toMatchObject({
      status: 403
    });
  });

  it('allows admins to create, update, and delete tasks', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    const authService = moduleRef.get(AuthService);
    const controller = moduleRef.get(TasksController);
    const admin = await authService.buildAuthenticatedUser('user-002');

    const created = await controller.create(
      {
        title: 'Backend controller test task',
        category: 'Testing',
        status: 'Open'
      },
      admin
    );
    expect(created.title).toBe('Backend controller test task');

    const updated = await controller.update(created.id, { status: 'Done' }, admin);
    expect(updated.status).toBe('Done');

    await expect(controller.get(created.id, admin)).resolves.toEqual(
      expect.objectContaining({ id: created.id })
    );

    await controller.delete(created.id, admin);
    await expect(controller.get(created.id, admin)).rejects.toMatchObject({
      status: 404
    });
  });
});
