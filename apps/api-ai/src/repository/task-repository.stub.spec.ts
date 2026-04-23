import { TaskRepositoryStub } from './task-repository.stub';

describe('TaskRepositoryStub', () => {
  it('indexes tasks on create and update, and removes vectors on delete', async () => {
    const taskIndexing = {
      indexTask: jest.fn().mockResolvedValue(undefined),
      removeTask: jest.fn().mockResolvedValue(undefined)
    };
    const repository = new TaskRepositoryStub(taskIndexing as never);

    const created = await repository.create({
      title: 'Ship acceptance-rate tracking',
      category: 'Analytics',
      priority: 'Medium',
      tags: ['metrics']
    });
    expect(taskIndexing.indexTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.id, title: 'Ship acceptance-rate tracking' })
    );

    const updated = await repository.update(created.id, {
      title: 'Ship acceptance-rate tracking v2',
      tags: ['metrics', 'feedback']
    });
    expect(updated.title).toBe('Ship acceptance-rate tracking v2');
    expect(updated.tags).toEqual(['metrics', 'feedback']);
    expect(taskIndexing.indexTask).toHaveBeenCalledTimes(2);
    expect(taskIndexing.indexTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: created.id,
        title: 'Ship acceptance-rate tracking v2',
        tags: ['metrics', 'feedback']
      })
    );

    await repository.delete(created.id);
    expect(taskIndexing.removeTask).toHaveBeenCalledWith(created.id);
  });
});
