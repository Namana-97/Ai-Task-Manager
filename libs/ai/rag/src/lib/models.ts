import Anthropic from '@anthropic-ai/sdk';
import { ScopeFilter, SearchResult } from '@ai-task-manager/ai/embeddings';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export type AnthropicTool = Anthropic.Tool;

export interface LlmRequest {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Message[];
  stream?: boolean;
  tools?: AnthropicTool[];
}

export interface SourceReference {
  taskId: string;
  title: string;
  similarity: number;
}

export interface RagResponse {
  answer: string;
  sources: SourceReference[];
  tokensUsed: number;
  retrievalLatencyMs: number;
}

export interface RagAskRequest {
  question: string;
  scope: ScopeFilter;
  conversationHistory: Message[];
}

export interface RetrievedPayload {
  results: SearchResult[];
  retrievalLatencyMs: number;
}
