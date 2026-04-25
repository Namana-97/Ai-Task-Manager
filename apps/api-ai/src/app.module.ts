import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmbeddingClient, VectorStoreClient } from '@ai-task-manager/ai/embeddings';
import {
  AuditLogger,
  CanaryTokenValidator,
  InputSanitiser,
  OutputValidator,
  SlidingWindowRateLimiter
} from '@ai-task-manager/ai/guardrails';
import {
  AnthropicIntentClassifier,
  CategorizationFeedbackWriter,
  TaskActionExecutor,
  TaskMutationStore
} from '@ai-task-manager/ai/intents';
import { GeminiKeyPool, LlmClient, PromptLoader, RagEngine } from '@ai-task-manager/ai/rag';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { QueryRouterService } from './chat/query-router.service';
import { QuerySessionStore } from './chat/query-session.store';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DatabaseService } from './database/database.service';
import { ChatHistoryService } from './history/chat-history.service';
import { CategorizationFeedbackRepository } from './repository/categorization-feedback.repository';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { InsightsController } from './insights/insights.controller';
import { InsightsService } from './insights/insights.service';
import { IntentsController } from './intents/intents.controller';
import { AppBootstrapService } from './app-bootstrap.service';
import { TasksModule } from './tasks/tasks.module';
import { TaskRepositoryStub } from './repository/task-repository.stub';

@Module({
  imports: [ScheduleModule.forRoot(), TasksModule],
  controllers: [ChatController, ReportsController, InsightsController, IntentsController],
  providers: [
    AppBootstrapService,
    AuditLogger,
    CanaryTokenValidator,
    ChatHistoryService,
    ChatService,
    QueryRouterService,
    QuerySessionStore,
    DatabaseService,
    EmbeddingClient,
    GeminiKeyPool,
    InputSanitiser,
    InsightsService,
    JwtAuthGuard,
    LlmClient,
    OutputValidator,
    PromptLoader,
    RagEngine,
    ReportsService,
    SlidingWindowRateLimiter,
    TaskActionExecutor,
    CategorizationFeedbackRepository,
    VectorStoreClient,
    AnthropicIntentClassifier,
    { provide: TaskMutationStore, useExisting: TaskRepositoryStub },
    { provide: CategorizationFeedbackWriter, useExisting: CategorizationFeedbackRepository }
  ]
})
export class AppModule {}
