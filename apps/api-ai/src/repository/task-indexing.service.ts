import { Inject, Injectable } from '@nestjs/common';
import { buildTaskDocument, EmbeddingClient, VectorStoreClient } from '@ai-task-manager/ai/embeddings';
import { Task } from '../common/contracts';

@Injectable()
export class TaskIndexingService {
  constructor(
    @Inject(EmbeddingClient)
    private readonly embeddingClient: EmbeddingClient,
    @Inject(VectorStoreClient)
    private readonly vectorStore: VectorStoreClient
  ) {}

  async indexTask(task: Task): Promise<void> {
    const document = buildTaskDocument({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      status: task.status,
      createdAt: task.createdAt,
      assigneeName: task.assignee.name,
      assigneeId: task.assignee.id,
      assigneeRole: task.assignee.role,
      orgId: task.org.id,
      orgName: task.org.name,
      tags: task.tags,
      activityLog: task.activityLog
    });
    const [vector] = await this.embeddingClient.embed([document]);
    await this.vectorStore.upsert({
      id: task.id,
      orgId: task.org.id,
      assigneeId: task.assignee.id,
      role: task.role,
      vector,
      metadata: {
        title: task.title,
        status: task.status,
        category: task.category,
        priority: task.priority,
        tags: task.tags,
        orgName: task.org.name,
        assigneeName: task.assignee.name,
        document,
        inactive: false
      }
    });
  }

  async removeTask(taskId: string): Promise<void> {
    await this.vectorStore.delete(taskId);
  }
}
