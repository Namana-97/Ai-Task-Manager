import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CategorizationFeedbackEvent,
  CategorizationFeedbackWriter
} from '@ai-task-manager/ai/intents';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CategorizationFeedbackRepository extends CategorizationFeedbackWriter {
  private readonly events: CategorizationFeedbackEvent[] = [];

  constructor(
    @Optional() @Inject(DatabaseService) private readonly db?: DatabaseService
  ) {
    super();
  }

  async recordFeedback(event: CategorizationFeedbackEvent): Promise<void> {
    if (this.db?.isConfigured()) {
      await this.db.query(
        `
          INSERT INTO categorization_feedback (
            id,
            user_id,
            task_id,
            decision,
            suggested_category,
            suggested_priority,
            suggested_tags,
            final_category,
            final_priority,
            final_tags,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11)
        `,
        [
          randomUUID(),
          event.userId,
          event.taskId,
          event.decision,
          event.suggestedCategory ?? null,
          event.suggestedPriority ?? null,
          JSON.stringify(event.suggestedTags ?? []),
          event.finalCategory ?? null,
          event.finalPriority ?? null,
          JSON.stringify(event.finalTags ?? []),
          event.createdAt
        ]
      );
      return;
    }

    this.events.push({ ...event });
  }

  list(): CategorizationFeedbackEvent[] {
    return [...this.events];
  }

  getAcceptanceRate(): number {
    return calculateAcceptanceRate(this.events);
  }

  async getAcceptanceRateStats(): Promise<{
    total: number;
    accepted: number;
    edited: number;
    rejected: number;
    acceptanceRate: number;
  }> {
    if (this.db?.isConfigured()) {
      const result = await this.db.query(
        `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE decision = 'accepted')::int AS accepted,
            COUNT(*) FILTER (WHERE decision = 'edited')::int AS edited,
            COUNT(*) FILTER (WHERE decision = 'rejected')::int AS rejected
          FROM categorization_feedback
        `
      );

      const row = result.rows[0] as {
        total?: number;
        accepted?: number;
        edited?: number;
        rejected?: number;
      };
      const total = row.total ?? 0;
      return {
        total,
        accepted: row.accepted ?? 0,
        edited: row.edited ?? 0,
        rejected: row.rejected ?? 0,
        acceptanceRate: total > 0 ? (row.accepted ?? 0) / total : 0
      };
    }

    const accepted = this.events.filter((event) => event.decision === 'accepted').length;
    const edited = this.events.filter((event) => event.decision === 'edited').length;
    const rejected = this.events.filter((event) => event.decision === 'rejected').length;
    const total = this.events.length;
    return {
      total,
      accepted,
      edited,
      rejected,
      acceptanceRate: total > 0 ? accepted / total : 0
    };
  }
}

export function calculateAcceptanceRate(
  events: Array<Pick<CategorizationFeedbackEvent, 'decision'>>
): number {
  if (!events.length) {
    return 0;
  }

  const accepted = events.filter((event) => event.decision === 'accepted').length;
  return accepted / events.length;
}
