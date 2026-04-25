import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'admin' | 'viewer';
  orgId: string;
  orgName: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AuthSession | null>(this.readSession());

  readonly session = this.sessionState.asReadonly();

  login(username: string, password: string): Observable<AuthSession> {
    return this.http
      .post<AuthSession>('/api/auth/login', { username, password })
      .pipe(tap((session) => this.persistSession(session)));
  }

  restoreSession(): AuthSession | null {
    const session = this.readSession();
    this.sessionState.set(session);
    return session;
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    this.sessionState.set(null);
  }

  isAuthenticated(): boolean {
    return Boolean(this.sessionState());
  }

  currentUser(): AuthUser | null {
    return this.sessionState()?.user ?? null;
  }

  private persistSession(session: AuthSession): void {
    localStorage.setItem('authToken', session.token);
    localStorage.setItem('authUser', JSON.stringify(session.user));
    this.sessionState.set(session);
  }

  private readSession(): AuthSession | null {
    const token = localStorage.getItem('authToken')?.trim();
    if (!token) {
      return null;
    }

    const rawUser = localStorage.getItem('authUser');
    if (!rawUser) {
      return null;
    }

    try {
      return {
        token,
        user: JSON.parse(rawUser) as AuthUser
      };
    } catch {
      return null;
    }
  }
}
