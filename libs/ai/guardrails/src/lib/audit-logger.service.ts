import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuditEntry } from './types';

@Injectable()
export class AuditLogger {
  private readonly logger = new Logger(AuditLogger.name);
  private readonly pool = process.env.VECTOR_STORE_URL
    ? new Pool({ connectionString: process.env.VECTOR_STORE_URL })
    : null;

  logLlmInteraction(entry: AuditEntry): void {
    if (process.env.LOG_LLM_INTERACTIONS === 'true') {
      this.logger.debug(JSON.stringify(entry));
    }

    if (!this.pool) {
      return;
    }

    void this.pool.query(
      `
        INSERT INTO llm_audit_log
          (id, user_id, org_id, input_hash, output_hash, tokens_used, latency_ms, flagged, timestamp)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        entry.userId,
        entry.orgId,
        entry.inputHash,
        entry.outputHash,
        entry.tokensUsed,
        entry.latencyMs,
        entry.flagged,
        entry.timestamp
      ]
    );
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
