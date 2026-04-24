import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiKeyState {
  apiKey: string;
  cooldownUntil: number;
}

@Injectable()
export class GeminiKeyPool {
  private readonly logger = new Logger(GeminiKeyPool.name);
  private readonly cooldownMs = Number(process.env.GEMINI_KEY_COOLDOWN_MS ?? 30_000);
  private readonly baseBackoffMs = Number(process.env.GEMINI_RETRY_BASE_MS ?? 250);
  private readonly clients = new Map<string, GoogleGenerativeAI>();
  private readonly keys: GeminiKeyState[] = this.loadKeys();
  private nextKeyIndex = 0;

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  async withClient<T>(operation: (client: GoogleGenerativeAI) => Promise<T>): Promise<T> {
    if (!this.keys.length) {
      throw new Error('No Gemini API keys configured');
    }

    const selection = this.selectAvailableKeys();
    if (selection.waitMs > 0) {
      await this.delay(selection.waitMs);
    }

    let lastError: unknown;
    for (const index of selection.indices) {
      const key = this.keys[index];

      try {
        const result = await operation(this.getClient(key.apiKey));
        key.cooldownUntil = 0;
        this.nextKeyIndex = (index + 1) % this.keys.length;
        return result;
      } catch (error) {
        lastError = error;
        if (!this.isQuotaError(error)) {
          throw error;
        }

        key.cooldownUntil = Date.now() + this.cooldownMs;
        this.nextKeyIndex = (index + 1) % this.keys.length;
        this.logger.warn(
          `Gemini quota exhausted for key ${index + 1}/${this.keys.length}; cooling down for ${this.cooldownMs}ms`
        );
        await this.delay(this.baseBackoffMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('All Gemini API keys are currently rate limited');
  }

  async *streamWithClient<T>(
    operation: (client: GoogleGenerativeAI) => AsyncGenerator<T>
  ): AsyncGenerator<T> {
    if (!this.keys.length) {
      throw new Error('No Gemini API keys configured');
    }

    const selection = this.selectAvailableKeys();
    if (selection.waitMs > 0) {
      await this.delay(selection.waitMs);
    }

    let lastError: unknown;
    for (const index of selection.indices) {
      const key = this.keys[index];
      let emitted = false;

      try {
        for await (const chunk of operation(this.getClient(key.apiKey))) {
          emitted = true;
          yield chunk;
        }

        key.cooldownUntil = 0;
        this.nextKeyIndex = (index + 1) % this.keys.length;
        return;
      } catch (error) {
        lastError = error;
        if (emitted || !this.isQuotaError(error)) {
          throw error;
        }

        key.cooldownUntil = Date.now() + this.cooldownMs;
        this.nextKeyIndex = (index + 1) % this.keys.length;
        this.logger.warn(
          `Gemini quota exhausted for key ${index + 1}/${this.keys.length}; cooling down for ${this.cooldownMs}ms`
        );
        await this.delay(this.baseBackoffMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('All Gemini API keys are currently rate limited');
  }

  isQuotaError(error: unknown): boolean {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: number }).status)
        : undefined;
    const message = error instanceof Error ? error.message : String(error ?? '');

    return (
      status === 429 ||
      /quota|rate limit|too many requests|resource exhausted|resource_exhausted/i.test(message)
    );
  }

  private loadKeys(): GeminiKeyState[] {
    const raw = process.env.GEMINI_API_KEYS ?? process.env.LLM_API_KEY ?? '';
    return raw
      .split(/[,\n]/)
      .map((key) => key.trim())
      .filter(Boolean)
      .map((apiKey) => ({ apiKey, cooldownUntil: 0 }));
  }

  private selectAvailableKeys(): { indices: number[]; waitMs: number } {
    const now = Date.now();
    const orderedIndices = this.keys.map((_, offset) => (this.nextKeyIndex + offset) % this.keys.length);
    const available = orderedIndices.filter((index) => this.keys[index].cooldownUntil <= now);

    if (available.length > 0) {
      return { indices: available, waitMs: 0 };
    }

    const nextReadyAt = Math.min(...this.keys.map((key) => key.cooldownUntil));
    return {
      indices: orderedIndices,
      waitMs: Math.max(0, nextReadyAt - now)
    };
  }

  private getClient(apiKey: string): GoogleGenerativeAI {
    const existing = this.clients.get(apiKey);
    if (existing) {
      return existing;
    }

    const client = new GoogleGenerativeAI(apiKey);
    this.clients.set(apiKey, client);
    return client;
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
