import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { performance } from 'node:perf_hooks';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const MAX_RETRIES = 5;

@Injectable()
export class EmbeddingClient {
  private readonly logger = new Logger(EmbeddingClient.name);
  private readonly provider = process.env.EMBEDDING_PROVIDER ?? 'openai';
  private readonly model = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
  private readonly dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS);
  private readonly openaiClient = process.env.EMBEDDING_API_KEY
    ? new OpenAI({ apiKey: process.env.EMBEDDING_API_KEY })
    : null;

  async embed(texts: string[]): Promise<number[][]> {
    const batches: string[][] = [];
    for (let index = 0; index < texts.length; index += BATCH_SIZE) {
      batches.push(texts.slice(index, index + BATCH_SIZE));
    }

    const embeddings: number[][] = [];
    for (const batch of batches) {
      const start = performance.now();
      const batchEmbeddings =
        this.provider === 'local'
          ? await this.embedLocally(batch)
          : await this.embedWithRetry(batch);
      const latencyMs = Math.round(performance.now() - start);
      this.logger.log(`Embedded batch of ${batch.length} texts in ${latencyMs}ms`);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  private async embedWithRetry(batch: string[], attempt = 0): Promise<number[][]> {
    try {
      if (!this.openaiClient) {
        this.logger.warn('EMBEDDING_API_KEY missing, falling back to deterministic local embeddings');
        return this.embedLocally(batch);
      }

      const response = await this.openaiClient.embeddings.create({
        model: this.model,
        input: batch
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      const isRateLimited =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        Number((error as { status?: number }).status) === 429;

      if (!isRateLimited || attempt >= MAX_RETRIES) {
        throw error;
      }

      const baseDelay = 250 * 2 ** attempt;
      const jitter = Math.round(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
      return this.embedWithRetry(batch, attempt + 1);
    }
  }

  private async embedLocally(batch: string[]): Promise<number[][]> {
    return batch.map((text) => {
      const vector = new Array<number>(this.dimensions).fill(0);
      for (let index = 0; index < text.length; index += 1) {
        const slot = index % this.dimensions;
        vector[slot] += text.charCodeAt(index) / 255;
      }

      const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
      return vector.map((value) => value / magnitude);
    });
  }
}
