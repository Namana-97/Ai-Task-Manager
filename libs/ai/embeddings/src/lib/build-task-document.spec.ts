import { buildTaskDocument } from './build-task-document';

describe('buildTaskDocument', () => {
  it('serialises all populated fields', () => {
    const document = buildTaskDocument({
      id: 'task-1',
      title: 'Fix login flow',
      description: 'Users hit a redirect loop',
      category: 'Security',
      status: 'Blocked',
      createdAt: '2026-04-21T10:00:00.000Z',
      assigneeName: 'Alex Rivera',
      assigneeRole: 'Engineer',
      orgName: 'Acme Product',
      tags: ['security', 'sso'],
      activityLog: [
        {
          timestamp: '2026-04-21T11:00:00.000Z',
          actorName: 'Alex Rivera',
          action: 'triaged',
          details: 'Reproduced in staging'
        }
      ]
    });

    expect(document).toContain('[Title]: Fix login flow');
    expect(document).toContain('[Assignee]: Alex Rivera (Engineer, Org: Acme Product)');
    expect(document).toContain('[Tags]: security, sso');
    expect(document).toContain('Reproduced in staging');
  });

  it('omits nullish optional fields', () => {
    expect(
      buildTaskDocument({
        id: 'task-2',
        title: 'Minimal task',
        description: null,
        category: undefined,
        status: null,
        createdAt: null,
        tags: [],
        activityLog: null
      })
    ).toBe('[Title]: Minimal task');
  });

  it('preserves long strings', () => {
    const description = 'a'.repeat(2048);
    const document = buildTaskDocument({
      id: 'task-3',
      title: 'Large payload',
      description
    });

    expect(document).toContain(description);
  });
});
