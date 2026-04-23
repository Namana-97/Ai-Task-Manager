import { Message } from '@ai-task-manager/ai/rag';
import { ScopeFilter } from '@ai-task-manager/ai/embeddings';

export type IntentType =
  | 'query'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'status_report'
  | 'unknown';

export interface TaskMutationParams {
  taskId?: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  assignee?: string;
  status?: string;
  dueDate?: string;
  tags?: string[];
  recurrence?: string;
  suggestedCategory?: string;
  suggestedPriority?: 'Critical' | 'High' | 'Medium' | 'Low';
  suggestedTags?: string[];
  categorizationDecision?: 'accepted' | 'edited' | 'rejected';
}

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  parameters?: TaskMutationParams;
  requiresConfirmation: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface IntentClassifier {
  classify(message: string, conversationHistory: Message[]): Promise<ClassifiedIntent>;
}

export interface IntentExecutor {
  execute(intent: ClassifiedIntent, scope: ScopeFilter): Promise<ActionResult>;
}
