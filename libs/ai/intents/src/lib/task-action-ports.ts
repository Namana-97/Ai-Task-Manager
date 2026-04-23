export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type CategorizationDecision = 'accepted' | 'edited' | 'rejected';

export interface TaskMutationPayload {
  title: string;
  description?: string;
  category?: string;
  priority?: TaskPriority;
  assignee?: string;
  status?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TaskMutationRecord {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  assignee: { id: string; name: string; role: string };
  org: { id: string; name: string };
  tags: string[];
  activityLog: Array<{ timestamp: string; actorName: string; action: string; details?: string }>;
  role: 'viewer' | 'admin' | 'owner';
}

export interface CategorizationFeedbackEvent {
  userId: string;
  taskId: string;
  decision: CategorizationDecision;
  suggestedCategory?: string;
  suggestedPriority?: TaskPriority;
  suggestedTags?: string[];
  finalCategory?: string;
  finalPriority?: TaskPriority;
  finalTags?: string[];
  createdAt: string;
}

export abstract class TaskMutationStore {
  abstract create(params: TaskMutationPayload): Promise<TaskMutationRecord>;
  abstract update(taskId: string, params: Partial<TaskMutationPayload>): Promise<TaskMutationRecord>;
  abstract delete(taskId: string): Promise<void>;
}

export abstract class CategorizationFeedbackWriter {
  abstract recordFeedback(event: CategorizationFeedbackEvent): Promise<void>;
}

export function determineCategorizationDecision(input: {
  decision?: CategorizationDecision;
  suggestedCategory?: string;
  suggestedPriority?: CategorizationFeedbackEvent['suggestedPriority'];
  suggestedTags?: string[];
  finalCategory?: string;
  finalPriority?: CategorizationFeedbackEvent['finalPriority'];
  finalTags?: string[];
}): CategorizationDecision {
  if (input.decision) {
    return input.decision;
  }

  const tagsMatch =
    JSON.stringify([...(input.suggestedTags ?? [])].sort()) ===
    JSON.stringify([...(input.finalTags ?? [])].sort());
  const categoryMatch = (input.suggestedCategory ?? '') === (input.finalCategory ?? '');
  const priorityMatch = (input.suggestedPriority ?? '') === (input.finalPriority ?? '');

  return categoryMatch && priorityMatch && tagsMatch ? 'accepted' : 'edited';
}
