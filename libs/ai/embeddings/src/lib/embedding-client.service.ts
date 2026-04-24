import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { performance } from 'node:perf_hooks';

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DIMENSIONS = 384;
const BATCH_SIZE = 100;
const MAX_RETRIES = 5;

@Injectable()
export class EmbeddingClient {
  private readonly logger = new Logger(EmbeddingClient.name);
  private readonly provider = process.env.EMBEDDING_PROVIDER ?? 'local';
  private readonly model = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL;
  private readonly dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS);
  private readonly openaiClient = process.env.EMBEDDING_API_KEY
    ? new OpenAI({ apiKey: process.env.EMBEDDING_API_KEY })
    : null;
  private static localPipeline: any = null;
  private static localPipelinePromise: Promise<any> | null = null;

  async embed(texts: string[]): Promise<number[][]> {
    const batches: string[][] = [];
    for (let index = 0; index < texts.length; index += BATCH_SIZE) {
      batches.push(texts.slice(index, index + BATCH_SIZE));
    }

    const embeddings: number[][] = [];
    for (const batch of batches) {
      const start = performance.now();
      const batchEmbeddings = await this.embedBatch(batch);
      const latencyMs = Math.round(performance.now() - start);
      this.logger.log(`Embedded batch of ${batch.length} texts in ${latencyMs}ms`);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  private async embedWithRetry(batch: string[], attempt = 0): Promise<number[][]> {
    try {
      if (!this.openaiClient) {
        this.logger.warn('EMBEDDING_API_KEY missing, falling back to local MiniLM embeddings');
        return this.embedLocal(batch);
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

  private async embedBatch(batch: string[]): Promise<number[][]> {
    if (this.provider === 'gemini') {
      return this.embedWithGemini(batch);
    }

    if (this.provider === 'openai') {
      return this.embedWithRetry(batch);
    }

    return this.embedLocal(batch);
  }

  private async embedWithGemini(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.LLM_API_KEY ?? '';
    if (!apiKey) {
      this.logger.warn('EMBEDDING_API_KEY missing, falling back to local MiniLM embeddings');
      return this.embedLocal(texts);
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-004'
    });

    const results: number[][] = [];
    for (const text of texts) {
      const result = await model.embedContent(text);
      results.push(result.embedding.values);
    }
    return results;
  }

  private async embedLocal(batch: string[]): Promise<number[][]> {
    try {
      const { pipeline } = await import('@xenova/transformers');

      if (!EmbeddingClient.localPipelinePromise) {
        this.logger.log(`Loading local embedding model (${this.model})...`);
        EmbeddingClient.localPipelinePromise = pipeline('feature-extraction', this.model)
          .then((loadedPipeline) => {
            EmbeddingClient.localPipeline = loadedPipeline;
            this.logger.log('Local model loaded.');
            return loadedPipeline;
          })
          .catch((error) => {
            EmbeddingClient.localPipelinePromise = null;
            throw error;
          });
      }

      const results: number[][] = [];
      const localPipeline =
        EmbeddingClient.localPipeline ?? (await EmbeddingClient.localPipelinePromise);
      for (const text of batch) {
        const output = await localPipeline(text, { pooling: 'mean', normalize: true });
        results.push(Array.from(output.data).slice(0, this.dimensions) as number[]);
      }
      return results;
    } catch (error) {
      this.logger.warn(
        `Local transformer model unavailable, falling back to deterministic embeddings: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      return this.embedDeterministic(batch);
    }
  }

  private embedDeterministic(batch: string[]): number[][] {
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
