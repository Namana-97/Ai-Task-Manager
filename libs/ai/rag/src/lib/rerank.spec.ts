import { rerank } from './rerank';

describe('rerank', () => {
  it('prefers documents with better combined semantic and keyword score', () => {
    const results = rerank('overdue sprint blockers', [
      { id: 'a', similarity: 0.89, metadata: {}, document: 'general analytics task' },
      { id: 'b', similarity: 0.75, metadata: {}, document: 'overdue sprint blocker with assignee note' }
    ]);

    expect(results[0].id).toBe('b');
  });
});
