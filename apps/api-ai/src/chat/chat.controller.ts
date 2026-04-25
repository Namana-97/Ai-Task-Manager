import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { RateLimitExceededError } from '@ai-task-manager/ai/guardrails';
import { RagResponse } from '@ai-task-manager/ai/rag';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../common/contracts';
import { ChatService } from './chat.service';
import { ChatHistoryService } from '../history/chat-history.service';
import { QueryRouterService } from './query-router.service';

interface StreamableResponse {
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  write(chunk: string): void;
  end(): void;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    @Inject(ChatService)
    private readonly chatService: ChatService,
    @Inject(ChatHistoryService)
    private readonly historyService: ChatHistoryService,
    @Optional()
    @Inject(QueryRouterService)
    private readonly queryRouter?: QueryRouterService
  ) {}

  @Post('ask')
  async ask(
    @Body() body: { message: string; stream?: boolean },
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: StreamableResponse
  ) {
    try {
      const routed = this.queryRouter
        ? await this.queryRouter.handle(body.message, user.id, user)
        : null;
      const result = routed
        ? await this.saveDirectResponse(body.message, routed, user)
        : await this.chatService.ask(body.message, user);

      if (body.stream) {
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.flushHeaders?.();

        for (const chunk of chunkString(result.answer, 24)) {
          response.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
        response.write(`data: ${JSON.stringify({ type: 'sources', sources: result.sources })}\n\n`);
        response.write('data: [DONE]\n\n');
        response.end();
        return;
      }

      return result;
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        response.setHeader('Retry-After', retryAfterSeconds(error.resetInMs).toString());
        throw new HttpException({
          message: error.message
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      throw error;
    }
  }

  @Get('history')
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string
  ) {
    return this.historyService.list(user.id, Number(limit ?? 20), before);
  }

  private async saveDirectResponse(
    message: string,
    result: RagResponse,
    user: AuthenticatedUser
  ): Promise<RagResponse> {
    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'user',
      content: message
    });
    await this.historyService.save({
      userId: user.id,
      orgId: user.orgId,
      role: 'assistant',
      content: result.answer,
      sources: result.sources
    });
    return result;
  }
}

function retryAfterSeconds(resetInMs: number): number {
  return Math.max(1, Math.ceil(resetInMs / 1000));
}

function chunkString(value: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}
