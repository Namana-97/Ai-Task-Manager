export type UserRole = 'viewer' | 'admin' | 'owner';

export interface TaskActivityEntry {
  timestamp: string;
  actorName: string;
  action: string;
  details?: string;
}

export interface TaskDocument {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  assigneeName?: string | null;
  assigneeId?: string | null;
  assigneeRole?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  tags?: string[] | null;
  activityLog?: TaskActivityEntry[] | null;
}

export interface VectorRecord {
  id: string;
  orgId: string;
  role: UserRole;
  assigneeId: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface ScopeFilter {
  orgId: string;
  userId: string;
  role: UserRole;
  childOrgIds?: string[];
}

export interface SearchResult {
  id: string;
  similarity: number;
  metadata: Record<string, unknown>;
  document?: string;
}
