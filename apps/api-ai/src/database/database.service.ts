import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;

  onModuleInit(): void {
    const connectionString = process.env.VECTOR_STORE_URL;
    if (!connectionString) {
      return;
    }

    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  isConfigured(): boolean {
    return this.pool !== null;
  }

  query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('DatabaseService is not configured');
    }

    return this.pool.query(sql, params);
  }
}
