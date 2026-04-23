import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChatPanelComponent, SourceReference } from '@task-ai/ui-chat';

interface Insight {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  taskIds: string[];
}

interface ActiveTaskRow {
  id: string;
  title: string;
  status: 'In Progress' | 'Done' | 'Blocked' | 'Open';
  category: string;
  assignee: { name: string };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatPanelComponent],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <span class="logo-mark">T</span>
          <span class="logo-text">TaskAI</span>
        </div>

        <nav class="sidebar-nav">
          <button class="nav-item active">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Dashboard
          </button>
          <button class="nav-item" (click)="loadTaskSnapshot()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            Tasks
          </button>
          <button class="nav-item" (click)="loadInsights()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M2 20h20M6 20V10l6-6 6 6v10"/>
            </svg>
            Insights
          </button>
          <button class="nav-item" (click)="loadStandup()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Standup
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="role-switcher">
            <span class="role-label">Dev role</span>
            <div class="role-pills">
              <button
                *ngFor="let r of roles"
                class="role-pill"
                [class.active]="currentRole() === r"
                (click)="switchRole(r)">
                {{ r }}
              </button>
            </div>
          </div>
          <div class="user-row">
            <div class="avatar">{{ currentRole().charAt(0).toUpperCase() }}</div>
            <div class="user-info">
              <span class="user-name">{{ roleUsers[currentRole()].name }}</span>
              <span class="user-role">{{ currentRole() }}</span>
            </div>
            <div class="online-dot"></div>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <header class="page-header">
          <div class="header-left">
            <h1 class="page-title">Dashboard</h1>
            <span class="page-subtitle">{{ today }}</span>
          </div>
          <div class="header-right">
            <div class="status-pill" [class.live]="backendOnline()">
              <span class="status-dot"></span>
              {{ backendOnline() ? 'Backend connected' : 'Connecting...' }}
            </div>
          </div>
        </header>

        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow">AI Operations Console</span>
            <h2>One surface for task health, live retrieval, and AI-assisted execution.</h2>
            <p>
              This shell is wired to the real backend through an Nx Angular dev server proxy, with
              role-aware chat and live standup and insight pulls.
            </p>
          </div>
          <div class="hero-accent">
            <div class="hero-kicker">Current focus</div>
            <strong>{{ heroFocus() }}</strong>
            <span>Switch roles to verify RBAC behavior instantly.</span>
          </div>
        </section>

        <div class="metrics-row" *ngIf="metrics()">
          <div class="metric-card">
            <span class="metric-value">{{ metrics()!.total }}</span>
            <span class="metric-label">Total surfaced</span>
          </div>
          <div class="metric-card accent">
            <span class="metric-value">{{ metrics()!.inProgress }}</span>
            <span class="metric-label">In progress</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">{{ metrics()!.completed }}</span>
            <span class="metric-label">Completed</span>
          </div>
          <div class="metric-card warn">
            <span class="metric-value">{{ metrics()!.overdue }}</span>
            <span class="metric-label">Overdue</span>
          </div>
        </div>

        <div class="content-grid">
          <section class="insights-panel" *ngIf="insights().length > 0">
            <h2 class="section-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Live insights
            </h2>
            <div class="insight-list">
              <div class="insight-item" *ngFor="let ins of insights()" [attr.data-severity]="ins.severity">
                <div class="insight-dot"></div>
                <div class="insight-copy">
                  <p class="insight-text">{{ ins.message }}</p>
                  <div class="insight-tasks">
                    <span class="task-chip" *ngFor="let id of ins.taskIds.slice(0, 3)">{{ id }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="standup-panel" *ngIf="standup()">
            <h2 class="section-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Today's standup
            </h2>
            <div class="standup-body" [innerHTML]="standup()"></div>
          </section>

          <section class="tasks-panel">
            <div class="tasks-header">
              <h2 class="section-title">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
                Active tasks
              </h2>
              <button class="refresh-button" type="button" (click)="loadTaskSnapshot()">Refresh</button>
            </div>
            <div class="task-list" *ngIf="tasks().length > 0; else noTasks">
              <div class="task-row" *ngFor="let t of tasks()">
                <div class="task-status-dot" [attr.data-status]="t.status"></div>
                <div class="task-body">
                  <span class="task-title">{{ t.title }}</span>
                  <span class="task-meta">{{ t.category }} · {{ t.assignee.name }}</span>
                </div>
                <span class="task-badge" [attr.data-status]="t.status">{{ t.status }}</span>
              </div>
            </div>
            <ng-template #noTasks>
              <div class="empty-state">
                <p>Loading task snapshot from the backend...</p>
              </div>
            </ng-template>
          </section>
        </div>
      </main>
    </div>

    <task-chat-panel (taskSelected)="onTaskSelected($event)"></task-chat-panel>
  `,
  styles: [
    `
      .app-shell {
        display: flex;
        height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(circle at top left, rgba(0, 229, 255, 0.08), transparent 24%),
          radial-gradient(circle at bottom right, rgba(0, 229, 255, 0.05), transparent 24%),
          var(--bg-base);
      }

      .sidebar {
        width: 236px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, rgba(255,255,255,0.015), transparent 18%), var(--bg-surface);
        border-right: 1px solid var(--border);
        padding: 22px 0;
      }

      .sidebar-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 20px 24px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 16px;
      }

      .logo-mark {
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, var(--accent), #7ff7ff);
        color: #000;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        box-shadow: 0 0 18px var(--accent-glow);
      }

      .logo-text {
        font-weight: 500;
        font-size: 15px;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }

      .sidebar-nav {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 10px;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        border: none;
        background: transparent;
        color: var(--text-secondary);
        font-size: 13px;
        font-family: var(--font-ui);
        cursor: pointer;
        text-align: left;
        transition: all 150ms ease;
        width: 100%;
      }

      .nav-item:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      .nav-item.active {
        background: var(--accent-dim);
        color: var(--accent);
      }

      .sidebar-footer {
        padding: 16px 16px 0;
        border-top: 1px solid var(--border);
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .role-switcher {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .role-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
      }

      .role-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .role-pill {
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-family: var(--font-ui);
        transition: all 150ms ease;
      }

      .role-pill:hover {
        border-color: var(--border-hover);
        color: var(--text-primary);
      }

      .role-pill.active {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-dim);
      }

      .user-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0 0;
      }

      .avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--accent-dim);
        border: 1px solid var(--accent);
        color: var(--accent);
        font-size: 11px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-info {
        flex: 1;
      }

      .user-name {
        display: block;
        font-size: 12px;
        font-weight: 500;
      }

      .user-role {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: capitalize;
      }

      .online-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 6px var(--success);
      }

      .main-content {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 32px 20px;
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(10, 14, 20, 0.88);
        backdrop-filter: blur(10px);
      }

      .page-title {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.03em;
      }

      .page-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
        display: block;
      }

      .status-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-muted);
        padding: 6px 12px;
        border-radius: 20px;
        border: 1px solid var(--border);
      }

      .status-pill.live {
        color: var(--success);
        border-color: rgba(63, 185, 80, 0.3);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
        gap: 16px;
        padding: 24px 32px 0;
      }

      .hero-copy,
      .hero-accent,
      .insights-panel,
      .standup-panel,
      .tasks-panel,
      .metric-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015)), var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-xl);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
      }

      .hero-copy {
        padding: 26px 28px;
      }

      .hero-copy .eyebrow,
      .section-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
      }

      .hero-copy h2 {
        margin: 14px 0 12px;
        max-width: 13ch;
        font-size: 36px;
        line-height: 1.05;
        letter-spacing: -0.05em;
      }

      .hero-copy p {
        max-width: 60ch;
        color: var(--text-secondary);
        font-size: 14px;
      }

      .hero-accent {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        justify-content: center;
        background:
          radial-gradient(circle at top right, rgba(0,229,255,0.16), transparent 38%),
          linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015)),
          var(--bg-surface);
      }

      .hero-kicker {
        color: var(--accent);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-family: var(--font-mono);
      }

      .hero-accent strong {
        font-size: 24px;
        line-height: 1.15;
        letter-spacing: -0.04em;
      }

      .hero-accent span {
        color: var(--text-secondary);
      }

      .metrics-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 20px 32px 0;
      }

      .metric-card {
        padding: 16px 20px;
        transition: border-color 200ms ease;
      }

      .metric-card:hover {
        border-color: var(--border-hover);
      }

      .metric-card.accent {
        border-color: rgba(0, 229, 255, 0.2);
        background: linear-gradient(180deg, rgba(0,229,255,0.08), rgba(255,255,255,0.015)), var(--bg-surface);
      }

      .metric-card.warn {
        border-color: rgba(210, 153, 34, 0.24);
      }

      .metric-value {
        display: block;
        font-size: 30px;
        font-weight: 500;
        letter-spacing: -0.05em;
        font-family: var(--font-mono);
      }

      .metric-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .metric-card.accent .metric-value {
        color: var(--accent);
      }

      .metric-card.warn .metric-value {
        color: var(--warning);
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        padding: 20px 32px 32px;
      }

      .tasks-panel {
        grid-column: 1 / -1;
      }

      .insights-panel,
      .standup-panel,
      .tasks-panel {
        padding: 20px;
      }

      .insight-list {
        display: grid;
        gap: 14px;
      }

      .insight-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
      }

      .insight-item:last-child {
        border-bottom: none;
      }

      .insight-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-top: 5px;
        flex-shrink: 0;
      }

      [data-severity="info"] .insight-dot {
        background: var(--accent);
      }

      [data-severity="warning"] .insight-dot {
        background: var(--warning);
        box-shadow: 0 0 6px rgba(210, 153, 34, 0.5);
      }

      [data-severity="critical"] .insight-dot {
        background: var(--danger);
        box-shadow: 0 0 6px rgba(248, 81, 73, 0.5);
      }

      .insight-copy {
        flex: 1;
      }

      .insight-text {
        font-size: 13px;
        line-height: 1.5;
      }

      .insight-tasks {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      .task-chip {
        font-size: 10px;
        font-family: var(--font-mono);
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--bg-hover);
        color: var(--accent);
        border: 1px solid rgba(0, 229, 255, 0.2);
      }

      .standup-body {
        font-size: 13px;
        line-height: 1.7;
        color: var(--text-secondary);
      }

      .standup-body :is(h1, h2, h3) {
        color: var(--text-primary);
        margin: 10px 0 6px;
        font-size: 14px;
      }

      .standup-body ul {
        padding-left: 16px;
      }

      .tasks-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }

      .refresh-button {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-secondary);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
      }

      .refresh-button:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      .task-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
      }

      .task-row:last-child {
        border-bottom: none;
      }

      .task-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .task-status-dot[data-status="Done"] {
        background: var(--success);
      }

      .task-status-dot[data-status="In Progress"] {
        background: var(--accent);
        box-shadow: 0 0 6px var(--accent-glow);
      }

      .task-status-dot[data-status="Open"] {
        background: var(--text-muted);
      }

      .task-status-dot[data-status="Blocked"] {
        background: var(--danger);
      }

      .task-body {
        flex: 1;
      }

      .task-title {
        display: block;
        font-size: 13px;
        font-weight: 500;
      }

      .task-meta {
        font-size: 11px;
        color: var(--text-muted);
      }

      .task-badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 20px;
        border: 1px solid var(--border);
        color: var(--text-secondary);
        font-family: var(--font-mono);
        white-space: nowrap;
      }

      .task-badge[data-status="In Progress"] {
        border-color: rgba(0, 229, 255, 0.3);
        color: var(--accent);
      }

      .task-badge[data-status="Blocked"] {
        border-color: rgba(248, 81, 73, 0.3);
        color: var(--danger);
      }

      .task-badge[data-status="Done"] {
        border-color: rgba(63, 185, 80, 0.3);
        color: var(--success);
      }

      .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
      }

      @media (max-width: 1200px) {
        .hero,
        .content-grid {
          grid-template-columns: 1fr;
        }

        .metrics-row {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 900px) {
        .sidebar {
          display: none;
        }

        .page-header,
        .hero,
        .metrics-row,
        .content-grid {
          padding-left: 18px;
          padding-right: 18px;
        }

        .metrics-row {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  readonly roles = ['admin', 'viewer', 'owner'] as const;
  readonly currentRole = signal<string>(localStorage.getItem('mockUser') ?? 'admin');
  readonly backendOnline = signal(false);
  readonly metrics = signal<{ total: number; inProgress: number; completed: number; overdue: number } | null>(null);
  readonly tasks = signal<ActiveTaskRow[]>([]);
  readonly insights = signal<Insight[]>([]);
  readonly standup = signal<SafeHtml | null>(null);
  readonly heroFocus = signal('Shipping AI chat with real backend retrieval.');
  readonly today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  readonly roleUsers: Record<string, { name: string }> = {
    admin: { name: 'Jane (Admin)' },
    viewer: { name: 'Bob (Viewer)' },
    owner: { name: 'Carol (Owner)' }
  };

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    localStorage.setItem('mockUser', this.currentRole());
    this.checkBackend();
    this.loadTaskSnapshot();
    this.loadInsights();
  }

  checkBackend(): void {
    this.http.get('/chat/history?limit=1').subscribe({
      next: () => this.backendOnline.set(true),
      error: () => this.backendOnline.set(false)
    });
  }

  loadTaskSnapshot(): void {
    Promise.all([
      this.askQuestion('What tasks are in progress right now?'),
      this.askQuestion('Which tasks were completed recently?'),
      this.askQuestion('Which tasks are overdue right now?')
    ])
      .then(([inProgress, completed, overdue]) => {
        this.backendOnline.set(true);
        const activeRows = this.sourcesToTasks(inProgress.sources ?? [], 'In Progress');
        this.tasks.set(activeRows);

        const uniqueIds = new Set<string>([
          ...activeRows.map((task) => task.id),
          ...(completed.sources ?? []).map((source) => source.taskId),
          ...(overdue.sources ?? []).map((source) => source.taskId)
        ]);

        this.metrics.set({
          total: uniqueIds.size,
          inProgress: inProgress.sources?.length ?? 0,
          completed: completed.sources?.length ?? 0,
          overdue: overdue.sources?.length ?? 0
        });

        if ((overdue.sources?.length ?? 0) > 0) {
          this.heroFocus.set('Overdue work surfaced by live backend retrieval.');
        } else if ((inProgress.sources?.length ?? 0) > 0) {
          this.heroFocus.set('Platform and analytics work are actively moving this sprint.');
        }
      })
      .catch(() => {
        this.backendOnline.set(false);
      });
  }

  loadInsights(): void {
    this.http.get<{ insights: Insight[] }>('/insights').subscribe({
      next: (response) => {
        this.insights.set(response.insights ?? []);
        if (response.insights?.some((insight) => insight.severity === 'critical')) {
          this.heroFocus.set('Critical insights detected. Review the escalation list.');
        }
      }
    });
  }

  loadStandup(): void {
    this.http.get<{ markdown: string }>('/reports/standup').subscribe({
      next: (response) => {
        const html = marked.parse(response.markdown) as string;
        this.standup.set(
          this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(html))
        );
      }
    });
  }

  switchRole(role: string): void {
    this.currentRole.set(role);
    localStorage.setItem('mockUser', role);
    this.insights.set([]);
    this.standup.set(null);
    this.loadTaskSnapshot();
    this.loadInsights();
    this.checkBackend();
  }

  onTaskSelected(taskId: string): void {
    this.heroFocus.set(`Selected ${taskId} from AI retrieval results.`);
  }

  private async askQuestion(message: string): Promise<{ answer: string; sources?: SourceReference[] }> {
    const response = await fetch('/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dev-stub-token',
        'X-Mock-User': localStorage.getItem('mockUser') ?? 'admin'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as { answer: string; sources?: SourceReference[] };
  }

  private sourcesToTasks(sources: SourceReference[], status: ActiveTaskRow['status']): ActiveTaskRow[] {
    return sources.map((source) => ({
      id: source.taskId,
      title: source.title,
      status,
      category: this.deriveCategory(source.title),
      assignee: { name: this.deriveAssignee(source.title) }
    }));
  }

  private deriveCategory(title: string): string {
    const normalized = title.toLowerCase();
    if (normalized.includes('security') || normalized.includes('sso')) {
      return 'Security';
    }
    if (normalized.includes('design') || normalized.includes('ux') || normalized.includes('drawer')) {
      return 'UX';
    }
    if (normalized.includes('notification') || normalized.includes('api') || normalized.includes('search')) {
      return 'Platform';
    }
    if (normalized.includes('report') || normalized.includes('roadmap')) {
      return 'Planning';
    }
    return 'Operations';
  }

  private deriveAssignee(title: string): string {
    const normalized = title.toLowerCase();
    if (normalized.includes('design') || normalized.includes('ux')) {
      return 'Alex Rivera';
    }
    if (normalized.includes('report') || normalized.includes('roadmap')) {
      return 'Taylor Kim';
    }
    if (normalized.includes('security') || normalized.includes('api') || normalized.includes('search')) {
      return 'Jordan Lee';
    }
    return 'Morgan Patel';
  }
}
