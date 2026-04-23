import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AnthropicTool, LlmRequest } from './models';
import { RateLimitExceededError, SlidingWindowRateLimiter } from '@ai-task-manager/ai/guardrails';

const COST_TABLE: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude-sonnet-4-20250514': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gemini-1.5-flash': { inputPer1k: 0, outputPer1k: 0 },
  'gemini-1.5-flash-latest': { inputPer1k: 0, outputPer1k: 0 },
  'gemini-2.5-flash': { inputPer1k: 0, outputPer1k: 0 }
};

@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly provider = process.env.LLM_PROVIDER ?? 'gemini';
  private readonly model = this.resolveModel(process.env.LLM_MODEL ?? this.defaultModelForProvider(this.provider));
  private readonly anthropic = process.env.LLM_API_KEY
    ? new Anthropic({ apiKey: process.env.LLM_API_KEY })
    : null;
  private readonly openai = process.env.LLM_API_KEY
    ? new OpenAI({ apiKey: process.env.LLM_API_KEY })
    : null;
  private readonly gemini = process.env.LLM_API_KEY
    ? new GoogleGenerativeAI(process.env.LLM_API_KEY)
    : null;

  constructor(@Inject(SlidingWindowRateLimiter) private readonly rateLimiter: SlidingWindowRateLimiter) {}

  async complete(request: LlmRequest): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.stream({ ...request, stream: false })) {
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  async *stream(request: LlmRequest): AsyncGenerator<string> {
    const rateLimit = this.rateLimiter.checkRateLimit('global-llm');
    if (!rateLimit.allowed) {
      throw new RateLimitExceededError(rateLimit.resetInMs);
    }

    const estimatedInputTokens = this.estimateTokens([
      request.systemPrompt,
      request.userMessage,
      ...(request.conversationHistory?.map((message) => message.content) ?? [])
    ]);

    if (this.provider === 'gemini') {
      yield* this.streamGemini(request, estimatedInputTokens);
      return;
    }

    if (this.provider === 'openai') {
      yield* this.streamOpenAi(request, estimatedInputTokens);
      return;
    }

    if (this.provider === 'anthropic') {
      yield* this.streamAnthropic(request, estimatedInputTokens);
      return;
    }

    this.logger.warn(`Unknown LLM_PROVIDER "${this.provider}" — returning stub response`);
    yield this.fallbackAnswer(request.userMessage);
  }

  private async *streamGemini(request: LlmRequest, estimatedInputTokens: number): AsyncGenerator<string> {
    if (!this.gemini) {
      this.logger.warn('LLM_API_KEY missing, returning stub response');
      yield this.fallbackAnswer(request.userMessage);
      return;
    }

    const model = this.gemini.getGenerativeModel({
      model: this.model,
      systemInstruction: request.systemPrompt
    });
    const chat = model.startChat({
      history: (request.conversationHistory ?? []).map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }))
    });

    if (request.stream) {
      const response = await chat.sendMessageStream(request.userMessage);
      let outputTokens = 0;
      for await (const chunk of response.stream) {
        const token = chunk.text();
        if (!token) {
          continue;
        }
        outputTokens += this.estimateTokens([token]);
        yield token;
      }
      this.logEstimatedCost(estimatedInputTokens, outputTokens);
      return;
    }

    const response = await chat.sendMessage(request.userMessage);
    const text = response.response.text();
    this.logEstimatedCost(estimatedInputTokens, this.estimateTokens([text]));
    yield text;
  }

  private async *streamAnthropic(
    request: LlmRequest,
    estimatedInputTokens: number
  ): AsyncGenerator<string> {
    if (!this.anthropic) {
      yield this.fallbackAnswer(request.userMessage);
      return;
    }

    if (request.stream) {
      const stream = await this.anthropic.messages.stream({
        model: this.model,
        system: request.systemPrompt,
        max_tokens: 1024,
        messages: this.toAnthropicMessages(request),
        tools: request.tools as AnthropicTool[] | undefined
      });

      let outputTokens = 0;
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          outputTokens += this.estimateTokens([event.delta.text]);
          yield event.delta.text;
        }
      }
      this.logEstimatedCost(estimatedInputTokens, outputTokens);
      return;
    }

    const response = await this.anthropic.messages.create({
      model: this.model,
      system: request.systemPrompt,
      max_tokens: 1024,
      messages: this.toAnthropicMessages(request),
      tools: request.tools as AnthropicTool[] | undefined
    });
    const text = response.content
      .filter((block): block is Extract<(typeof response.content)[number], { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('');
    this.logEstimatedCost(estimatedInputTokens, this.estimateTokens([text]));
    yield text;
  }

  private async *streamOpenAi(request: LlmRequest, estimatedInputTokens: number): AsyncGenerator<string> {
    if (!this.openai) {
      yield this.fallbackAnswer(request.userMessage);
      return;
    }

    const response = await this.openai.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: 'system', content: request.systemPrompt },
        ...(request.conversationHistory?.map((message) => ({
          role: message.role,
          content: message.content
        })) ?? []),
        { role: 'user', content: request.userMessage }
      ]
    });

    let outputTokens = 0;
    for await (const part of response) {
      const token = part.choices[0]?.delta?.content ?? '';
      if (token) {
        outputTokens += this.estimateTokens([token]);
        yield token;
      }
    }
    this.logEstimatedCost(estimatedInputTokens, outputTokens);
  }

  private toAnthropicMessages(request: LlmRequest) {
    return [
      ...(request.conversationHistory?.map((message) => ({
        role: message.role,
        content: message.content
      })) ?? []),
      { role: 'user' as const, content: request.userMessage }
    ];
  }

  private estimateTokens(contents: string[]): number {
    return contents.reduce((sum, content) => sum + Math.ceil(content.length / 4), 0);
  }

  private defaultModelForProvider(provider: string): string {
    if (provider === 'openai') {
      return 'gpt-4o-mini';
    }
    if (provider === 'anthropic') {
      return 'claude-sonnet-4-20250514';
    }
    return 'gemini-2.5-flash';
  }

  private resolveModel(model: string): string {
    if (
      this.provider === 'gemini' &&
      ['gemini-1.5-flash', 'gemini-1.5-flash-latest'].includes(model)
    ) {
      return 'gemini-2.5-flash';
    }
    return model;
  }

  private logEstimatedCost(inputTokens: number, outputTokens: number): void {
    const rates = COST_TABLE[this.model] ?? COST_TABLE['claude-sonnet-4-20250514'];
    const cost = (inputTokens / 1000) * rates.inputPer1k + (outputTokens / 1000) * rates.outputPer1k;
    this.logger.log(
      `Estimated token usage input=${inputTokens} output=${outputTokens} cost=$${cost.toFixed(4)}`
    );
  }

  private fallbackAnswer(question: string): string {
    return `[STUB — no LLM key configured] You asked: "${question.slice(0, 80)}"`;
  }
}
