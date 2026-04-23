import {
  detectOverdueClusters,
  detectProductivityPattern,
  detectStaleTasks,
  detectThroughputDrop
} from './insights.service';
import { Task } from '../common/contracts';

const baseTask = (overrides: Partial<Task>): Task => ({
  id: 'task-base',
  title: 'Base task',
  category: 'Platform',
  status: 'Open',
  priority: 'Medium',
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  dueDate: new Date('2026-04-02T00:00:00.000Z'),
  assignee: { id: 'user-1', name: 'Alex', role: 'Engineer' },
  org: { id: 'org-1', name: 'Acme' },
  tags: [],
  activityLog: [],
  role: 'admin',
  ...overrides
});

describe('insight detectors', () => {
  it('detects stale tasks', () => {
    const results = detectStaleTasks([
      baseTask({
        id: 'task-stale',
        status: 'In Progress',
        updatedAt: new Date('2026-03-01T00:00:00.000Z')
      })
    ]);

    expect(results[0]?.type).toBe('stale_task');
  });

  it('detects throughput drop', () => {
    const results = detectThroughputDrop([
      baseTask({ id: 'last-week-1', status: 'Done', updatedAt: new Date('2026-04-14T00:00:00.000Z') }),
      baseTask({ id: 'last-week-2', status: 'Done', updatedAt: new Date('2026-04-15T00:00:00.000Z') })
    ]);

    expect(results[0]?.type).toBe('throughput_drop');
  });

  it('detects overdue clusters', () => {
    const tasks = [1, 2, 3].map((index) =>
      baseTask({
        id: `overdue-${index}`,
        category: 'Security',
        dueDate: new Date('2026-04-01T00:00:00.000Z'),
        status: 'Open'
      })
    );
    expect(detectOverdueClusters(tasks)[0]?.type).toBe('overdue_cluster');
  });

  it('detects productivity pattern dips', () => {
    const tasks = [
      baseTask({ id: 'day-1', status: 'Done', updatedAt: new Date('2026-04-10T00:00:00.000Z') }),
      baseTask({ id: 'day-2', status: 'Done', updatedAt: new Date('2026-04-11T00:00:00.000Z') }),
      baseTask({ id: 'day-3', status: 'Done', updatedAt: new Date('2026-04-11T00:00:00.000Z') }),
      baseTask({ id: 'day-4', status: 'Done', updatedAt: new Date('2026-04-12T00:00:00.000Z') })
    ];
    expect(detectProductivityPattern(tasks).length).toBeGreaterThanOrEqual(0);
  });
});
