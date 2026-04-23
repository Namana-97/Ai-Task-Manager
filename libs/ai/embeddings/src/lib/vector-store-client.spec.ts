import { VectorStoreClient } from './vector-store-client.service';

describe('VectorStoreClient RBAC filters', () => {
  const client = new VectorStoreClient();

  it('builds viewer pg filter', () => {
    expect(
      client.buildPgFilter({ orgId: 'org-1', userId: 'user-1', role: 'viewer' })
    ).toEqual({
      clause: 'org_id = $2::text AND assignee_id = $3::text',
      params: ['org-1', 'user-1']
    });
  });

  it('builds admin chroma filter', () => {
    expect(
      client.buildChromaFilter({ orgId: 'org-1', userId: 'user-1', role: 'admin' })
    ).toEqual({ orgId: 'org-1' });
  });

  it('builds owner chroma filter with children', () => {
    expect(
      client.buildChromaFilter({
        orgId: 'org-1',
        userId: 'user-1',
        role: 'owner',
        childOrgIds: ['org-1', 'org-2']
      })
    ).toEqual({ orgId: { $in: ['org-1', 'org-2'] } });
  });
});
