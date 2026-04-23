import { Inject, Injectable } from '@nestjs/common';
import { ScopeFilter } from '@ai-task-manager/ai/embeddings';
import { RagEngine } from '@ai-task-manager/ai/rag';
import { ChatHistoryService } from '../history/chat-history.service';
import { AuthenticatedUser } from '../common/contracts';

@Injectable()
export class ChatService {
  constructor(
    @Inject(RagEngine)
    private readonly ragEngine: RagEngine,
    @Inject(ChatHistoryService)
    private readonly historyService: ChatHistoryService
  ) {}

  async ask(message: string, user: AuthenticatedUser) {
    const historyPage = await this.historyService.list(user.id, 10);
    const conversationHistory = historyPage.messages
      .reverse()
      .map((entry) => ({ role: entry.role, content: entry.content, createdAt: entry.createdAt }));

    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'user',
      content: message
    });

    const scope: ScopeFilter = {
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      childOrgIds: user.childOrgIds
    };

    const response = await this.ragEngine.ask(message, scope, conversationHistory);
    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'assistant',
      content: response.answer,
      sources: response.sources
    });

    return response;
  }
}
