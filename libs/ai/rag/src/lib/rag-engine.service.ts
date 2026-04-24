import { Inject, Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import {
  buildTaskDocument,
  EmbeddingClient,
  ScopeFilter,
  SearchResult,
  VectorStoreClient
} from '@ai-task-manager/ai/embeddings';
import {
  AuditLogger,
  CanaryTokenValidator,
  InputSanitiser,
  SeverityLevel
} from '@ai-task-manager/ai/guardrails';
import { LlmClient } from './llm-client.service';
import { Message, RagResponse, SourceReference } from './models';
import { PromptLoader } from './prompt-loader.service';
import { rerank } from './rerank';

@Injectable()
export class RagEngine {
  constructor(
    @Inject(InputSanitiser)
    private readonly sanitiser: InputSanitiser,
    @Inject(CanaryTokenValidator)
    private readonly canaryValidator: CanaryTokenValidator,
    @Inject(EmbeddingClient)
    private readonly embeddingClient: EmbeddingClient,
    @Inject(VectorStoreClient)
    private readonly vectorStore: VectorStoreClient,
    @Inject(PromptLoader)
    private readonly promptLoader: PromptLoader,
    @Inject(LlmClient)
    private readonly llmClient: LlmClient,
    @Inject(AuditLogger)
    private readonly auditLogger: AuditLogger
  ) {}

  async ask(question: string, scope: ScopeFilter, conversationHistory: Message[]): Promise<RagResponse> {
    const sanitiseResult = this.sanitiser.sanitise(question, scope.userId);
    if (sanitiseResult.severity === SeverityLevel.HIGH) {
      return {
        answer: sanitiseResult.refusalMessage ?? 'Unable to process the request safely.',
        sources: [],
        tokensUsed: 0,
        retrievalLatencyMs: 0
      };
    }

    const safeQuestion = sanitiseResult.sanitised;
    const retrievalStart = performance.now();
    const [queryVector] = await this.embeddingClient.embed([safeQuestion]);
    const retrieved = await this.vectorStore.search(queryVector, scope, 8);
    const ranked = rerank(safeQuestion, retrieved);
    const retrievalLatencyMs = Math.round(performance.now() - retrievalStart);

    const systemPrompt = this.canaryValidator.inject(
      this.promptLoader.render('rag-system.txt', {
        orgName: String(ranked[0]?.metadata.orgName ?? scope.orgId),
        retrieved_task_documents: ranked
          .map((result) => String(result.document ?? result.metadata.document ?? ''))
          .join('\n\n---\n\n'),
        conversation_history: this.formatConversationHistory(conversationHistory),
        user_question: safeQuestion,
        CANARY_TOKEN: this.canaryValidator.getToken()
      })
    );

    const answer = await this.llmClient.complete({
      systemPrompt,
      userMessage: safeQuestion,
      conversationHistory
    });

    const leakedCanary = this.canaryValidator.hasLeak(answer);
    const safeAnswer = leakedCanary
      ? 'I could not safely answer that request.'
      : answer;

    const tokensUsed = Math.ceil((systemPrompt.length + safeQuestion.length + safeAnswer.length) / 4);
    this.auditLogger.logLlmInteraction({
      userId: scope.userId,
      orgId: scope.orgId,
      inputHash: this.auditLogger.hash(question),
      outputHash: this.auditLogger.hash(safeAnswer),
      tokensUsed,
      latencyMs: retrievalLatencyMs,
      flagged: sanitiseResult.flagged || leakedCanary,
      timestamp: new Date().toISOString()
    });

    return {
      answer: safeAnswer,
      sources: this.toSources(ranked),
      tokensUsed,
      retrievalLatencyMs
    };
  }

  private toSources(results: SearchResult[]): SourceReference[] {
    return results.map((result) => ({
      taskId: result.id,
      title: String(result.metadata.title ?? result.id),
      similarity: result.similarity
    }));
  }

  private formatConversationHistory(history: Message[]): string {
    return history.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
  }

  static toVectorRecordPayload(task: {
    id: string;
    org: { id: string; name: string };
    assignee: { id: string; name: string; role: string };
    role: 'viewer' | 'admin' | 'owner';
    title: string;
    description?: string;
    category: string;
    status: string;
    priority?: string;
    createdAt: Date;
    updatedAt?: Date;
    dueDate?: Date;
    tags: string[];
    activityLog: Array<{ timestamp: string; actorName: string; action: string; details?: string }>;
  }): string {
    return buildTaskDocument({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      dueDate: task.dueDate,
      assigneeName: task.assignee.name,
      assigneeId: task.assignee.id,
      assigneeRole: task.assignee.role,
      orgId: task.org.id,
      orgName: task.org.name,
      tags: task.tags,
      activityLog: task.activityLog
    });
  }
}
