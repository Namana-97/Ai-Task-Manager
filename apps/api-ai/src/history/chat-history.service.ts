import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ChatMessage } from '../common/contracts';

@Injectable()
export class ChatHistoryService {
  private readonly pool = process.env.VECTOR_STORE_URL
    ? new Pool({ connectionString: process.env.VECTOR_STORE_URL })
    : null;
  private readonly fallbackMessages: ChatMessage[] = [];

  async save(message: Omit<ChatMessage, 'id' | 'createdAt'> & { userId: string; orgId: string }): Promise<ChatMessage> {
    const stored: ChatMessage = {
      id: randomUUID(),
      role: message.role,
      content: message.content,
      sources: message.sources,
      createdAt: new Date().toISOString()
    };

    if (this.pool) {
      await this.pool.query(
        `
          INSERT INTO chat_messages (id, user_id, org_id, role, content, sources, created_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        `,
        [stored.id, message.userId, message.orgId, stored.role, stored.content, JSON.stringify(stored.sources ?? []), stored.createdAt]
      );
    } else {
      this.fallbackMessages.unshift(stored);
    }

    return stored;
  }

  async list(userId: string, limit = 20, before?: string): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
    if (this.pool) {
      const rows = await this.pool.query<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        sources: unknown[];
        created_at: string;
      }>(
        `
          SELECT id, role, content, sources, created_at
          FROM chat_messages
          WHERE user_id = $1
            AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
          ORDER BY created_at DESC, id DESC
          LIMIT $3
        `,
        [userId, before ?? null, limit + 1]
      );
      const items = rows.rows.slice(0, limit).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        sources: row.sources as ChatMessage['sources'],
        createdAt: row.created_at
      }));
      return {
        messages: items,
        nextCursor: rows.rows.length > limit ? rows.rows[limit - 1].created_at : null
      };
    }

    const filtered = before
      ? this.fallbackMessages.filter((message) => message.createdAt < before)
      : this.fallbackMessages;
    return {
      messages: filtered.slice(0, limit),
      nextCursor: filtered.length > limit ? filtered[limit - 1].createdAt : null
    };
  }
}
