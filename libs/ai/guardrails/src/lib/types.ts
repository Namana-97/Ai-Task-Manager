export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface SanitiseResult {
  sanitised: string;
  flagged: boolean;
  patterns: string[];
  severity: SeverityLevel;
  refusalMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetInMs: number;
}

export interface AuditEntry {
  userId: string;
  orgId: string;
  inputHash: string;
  outputHash: string;
  tokensUsed: number;
  latencyMs: number;
  flagged: boolean;
  timestamp: string;
}
