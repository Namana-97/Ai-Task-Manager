import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingClient, VectorStoreClient } from '@ai-task-manager/ai/embeddings';
import { TaskIndexingService } from '../repository/task-indexing.service';
import { TaskRepositoryStub } from '../repository/task-repository.stub';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { OrganizationEntity, TaskEntity, UserEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RequestContextModule } from '../common/request-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, UserEntity, OrganizationEntity]),
    AuthModule,
    AuditLogModule,
    RequestContextModule
  ],
  controllers: [TasksController],
  providers: [
    EmbeddingClient,
    VectorStoreClient,
    TaskIndexingService,
    TaskRepositoryStub,
    TasksService
  ],
  exports: [TaskIndexingService, TaskRepositoryStub, TasksService]
})
export class TasksModule {}
