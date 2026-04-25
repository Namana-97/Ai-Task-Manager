import { ScopeFilter } from '@ai-task-manager/ai/embeddings';
import { SourceReference } from '@ai-task-manager/ai/rag';

export interface ActivityEntry {
  timestamp: string;
  actorName: string;
  action: string;
  details?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  assignee: { id: string; name: string; role: string };
  org: { id: string; name: string };
  tags: string[];
  activityLog: ActivityEntry[];
  role: 'viewer' | 'admin' | 'owner';
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  category?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  assignee?: string;
  status?: string;
  dueDate?: string;
  tags?: string[];
}

export interface ITaskRepository {
  findByIds(ids: string[]): Promise<Task[]>;
  findUpdatedSince(userId: string, orgId: string | string[], since: Date): Promise<Task[]>;
  findAll(scope: ScopeFilter): Promise<Task[]>;
  create(params: CreateTaskParams): Promise<Task>;
  update(taskId: string, params: Partial<CreateTaskParams>): Promise<Task>;
  delete(taskId: string): Promise<void>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  username?: string;
  name?: string;
  orgId: string;
  orgName: string;
  role: 'viewer' | 'admin' | 'owner';
  childOrgIds?: string[];
  permissions?: string[];
}
