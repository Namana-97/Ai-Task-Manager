import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient, Collection, Where } from 'chromadb';
import { Pool } from 'pg';
import { ScopeFilter, SearchResult, VectorRecord } from './types';

interface PgSearchRow {
  id: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class VectorStoreClient {
  private readonly logger = new Logger(VectorStoreClient.name);
  private readonly provider = process.env.VECTOR_STORE ?? 'pgvector';
  private readonly dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS ?? '768', 10);
  private readonly pool =
    this.provider === 'pgvector' && process.env.VECTOR_STORE_URL
      ? new Pool({ connectionString: process.env.VECTOR_STORE_URL })
      : null;
  private readonly chroma =
    this.provider === 'chroma'
      ? new ChromaClient({ path: process.env.CHROMA_URL ?? 'http://localhost:8000' })
      : null;
  private chromaCollectionPromise: Promise<Collection> | null = null;

  async upsert(record: VectorRecord): Promise<void> {
    if (this.provider === 'chroma') {
      const collection = await this.getChromaCollection();
      await collection.upsert({
        ids: [record.id],
        embeddings: [record.vector],
        metadatas: [
          {
            ...record.metadata,
            orgId: record.orgId,
            assigneeId: record.assigneeId,
            role: record.role
          }
        ],
        documents: [String(record.metadata.document ?? '')]
      });
      return;
    }

    if (!this.pool) {
      this.logger.warn('VECTOR_STORE_URL missing, skipping vector upsert');
      return;
    }

    if (record.vector.length !== this.dimensions) {
      this.logger.warn(
        `Vector dimension mismatch for ${record.id}: expected ${this.dimensions}, received ${record.vector.length}`
      );
    }

    await this.pool.query(
      `
        INSERT INTO task_vectors (id, org_id, assignee_id, role, vector, metadata)
        VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          org_id = EXCLUDED.org_id,
          assignee_id = EXCLUDED.assignee_id,
          role = EXCLUDED.role,
          vector = EXCLUDED.vector,
          metadata = EXCLUDED.metadata
      `,
      [
        record.id,
        record.orgId,
        record.assigneeId,
        record.role,
        `[${record.vector.join(',')}]`,
        JSON.stringify(record.metadata)
      ]
    );
  }

  async delete(taskId: string): Promise<void> {
    if (this.provider === 'chroma') {
      const collection = await this.getChromaCollection();
      await collection.delete({ ids: [taskId] });
      return;
    }

    if (this.pool) {
      await this.pool.query('DELETE FROM task_vectors WHERE id = $1', [taskId]);
    }
  }

  async search(queryVector: number[], scope: ScopeFilter, topK: number): Promise<SearchResult[]> {
    if (this.provider === 'chroma') {
      const collection = await this.getChromaCollection();
      const where = this.buildChromaFilter(scope);
      const result = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: topK,
        where
      });

      return (result.ids[0] ?? []).map((id, index) => ({
        id,
        similarity: 1 - (result.distances[0]?.[index] ?? 1),
        metadata: (result.metadatas[0]?.[index] as Record<string, unknown>) ?? {},
        document: result.documents[0]?.[index] ?? undefined
      }));
    }

    if (!this.pool) {
      this.logger.warn('VECTOR_STORE_URL missing, returning empty vector search result');
      return [];
    }

    if (queryVector.length !== this.dimensions) {
      this.logger.warn(
        `Query vector dimension mismatch: expected ${this.dimensions}, received ${queryVector.length}`
      );
    }

    const { clause, params } = this.buildPgFilter(scope);
    const query = `
      SELECT
        id,
        1 - (vector <=> $1::vector) AS similarity,
        metadata
      FROM task_vectors
      WHERE ${clause}
      ORDER BY vector <=> $1::vector
      LIMIT $${params.length + 2}::int
    `;
    const values = [`[${queryVector.join(',')}]`, ...params, topK];
    const rows = await this.pool.query<PgSearchRow>(query, values);
    return rows.rows.map((row) => ({
      id: row.id,
      similarity: row.similarity,
      metadata: row.metadata,
      document: typeof row.metadata.document === 'string' ? row.metadata.document : undefined
    }));
  }

  buildPgFilter(scope: ScopeFilter): { clause: string; params: string[] } {
    if (scope.role === 'viewer') {
      return {
        clause: `org_id = $2::text AND assignee_id = $3::text`,
        params: [scope.orgId, scope.userId]
      };
    }

    if (scope.role === 'admin') {
      return {
        clause: `org_id = $2::text`,
        params: [scope.orgId]
      };
    }

    return {
      clause: `org_id = ANY($2::text[])`,
      params: scope.childOrgIds?.length ? scope.childOrgIds : [scope.orgId]
    };
  }

  buildChromaFilter(scope: ScopeFilter): Where {
    if (scope.role === 'viewer') {
      return {
        $and: [{ orgId: scope.orgId }, { assigneeId: scope.userId }]
      };
    }

    if (scope.role === 'admin') {
      return { orgId: scope.orgId };
    }

    return {
      orgId: { $in: scope.childOrgIds?.length ? scope.childOrgIds : [scope.orgId] }
    };
  }

  private getChromaCollection(): Promise<Collection> {
    if (!this.chromaCollectionPromise) {
      if (!this.chroma) {
        throw new Error('Chroma client not configured');
      }

      this.chromaCollectionPromise = this.chroma.getOrCreateCollection({
        name: 'task_vectors'
      });
    }
    return this.chromaCollectionPromise;
  }
}
