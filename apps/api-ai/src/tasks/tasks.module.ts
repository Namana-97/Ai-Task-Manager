import { Module } from '@nestjs/common';
import { EmbeddingClient, VectorStoreClient } from '@ai-task-manager/ai/embeddings';
import { TaskIndexingService } from '../repository/task-indexing.service';
import { TaskPersistenceService } from '../repository/task-persistence.service';
import { TaskRepositoryStub } from '../repository/task-repository.stub';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [
    EmbeddingClient,
    VectorStoreClient,
    TaskPersistenceService,
    TaskIndexingService,
    TaskRepositoryStub,
    TasksService
  ],
  exports: [TaskIndexingService, TaskRepositoryStub, TasksService]
})
export class TasksModule {}
