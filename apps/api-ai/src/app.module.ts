import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { QueryRouterService } from './chat/query-router.service';
import { QuerySessionStore } from './chat/query-session.store';
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
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { RequestContextModule } from './common/request-context.module';
import { RequestContextInterceptor } from './common/request-context.interceptor';
import {
  AuditLogEntity,
  OrganizationEntity,
  RoleEntity,
  TaskEntity,
  UserEntity
} from './database/entities';
import { join } from 'node:path';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database:
        process.env.NODE_ENV === 'test'
          ? ':memory:'
          : process.env.CORE_DB_PATH ?? join(process.cwd(), 'apps/api-ai/data/core.sqlite'),
      entities: [OrganizationEntity, RoleEntity, UserEntity, TaskEntity, AuditLogEntity],
      synchronize: true
    }),
    RequestContextModule,
    AuthModule,
    TasksModule,
    AuditLogModule
  ],
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
    RequestContextInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestContextInterceptor
    },
    { provide: TaskMutationStore, useExisting: TaskRepositoryStub },
    { provide: CategorizationFeedbackWriter, useExisting: CategorizationFeedbackRepository }
  ]
})
export class AppModule {}
