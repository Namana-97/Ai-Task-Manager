import { TaskIndexingService } from './task-indexing.service';
import { Task } from '../common/contracts';

describe('TaskIndexingService', () => {
  const task: Task = {
    id: 'task-9000',
    title: 'Improve search relevance',
    description: 'Tune retrieval weighting for task search',
    category: 'AI',
    status: 'In Progress',
    priority: 'High',
    createdAt: new Date('2026-04-20T10:00:00.000Z'),
    updatedAt: new Date('2026-04-21T11:00:00.000Z'),
    dueDate: new Date('2026-04-25T12:00:00.000Z'),
    assignee: { id: 'user-002', name: 'Jordan Lee', role: 'Backend Engineer' },
    org: { id: 'org-root', name: 'Acme Product' },
    tags: ['ai', 'search'],
    activityLog: [
      {
        timestamp: '2026-04-20T10:00:00.000Z',
        actorName: 'Jordan Lee',
        action: 'created task',
        details: 'Initial setup'
      }
    ],
    role: 'admin'
  };

  it('rebuilds the document, embeds it, and upserts the vector record', async () => {
    const embed = jest.fn().mockResolvedValue([[0.12, 0.34, 0.56]]);
    const upsert = jest.fn().mockResolvedValue(undefined);
    const service = new TaskIndexingService(
      { embed } as unknown as ConstructorParameters<typeof TaskIndexingService>[0],
      { upsert } as unknown as ConstructorParameters<typeof TaskIndexingService>[1]
    );

    await service.indexTask(task);

    expect(embed).toHaveBeenCalledWith([
      expect.stringContaining('[Title]: Improve search relevance')
    ]);
    expect(embed.mock.calls[0][0][0]).toContain('[Category]: AI');
    expect(embed.mock.calls[0][0][0]).toContain('[Tags]: ai, search');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-9000',
        orgId: 'org-root',
        assigneeId: 'user-002',
        role: 'admin',
        vector: [0.12, 0.34, 0.56],
        metadata: expect.objectContaining({
          title: 'Improve search relevance',
          category: 'AI',
          priority: 'High',
          inactive: false,
          document: expect.stringContaining('[Title]: Improve search relevance')
        })
      })
    );
  });

  it('deletes the vector record when a task is removed', async () => {
    const vectorStore = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskIndexingService(
      { embed: jest.fn() } as unknown as ConstructorParameters<typeof TaskIndexingService>[0],
      vectorStore as unknown as ConstructorParameters<typeof TaskIndexingService>[1]
    );

    await service.removeTask('task-9000');

    expect(vectorStore.delete).toHaveBeenCalledWith('task-9000');
  });
});
