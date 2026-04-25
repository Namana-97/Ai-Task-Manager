import { Injectable } from '@nestjs/common';
import { Task } from '../common/contracts';

export interface SessionContext {
  lastTasks: Task[];
}

@Injectable()
export class QuerySessionStore {
  private readonly sessions = new Map<string, SessionContext>();

  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  setLastTasks(sessionId: string, tasks: Task[]): void {
    this.sessions.set(sessionId, {
      lastTasks: [...tasks]
    });
  }
}
