import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChatPanelComponent } from '@task-ai/ui-chat';

interface Insight {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  taskIds: string[];
  metric?: { label: string; current: number; baseline: number; unit: string };
}

interface Task {
  id: string;
  title: string;
  status: string;
  category: string;
  assignee?: { name: string };
  priority?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatPanelComponent],
  template: `
    <div class="shell" [class.loaded]="loaded()">
      <div class="scanline"></div>

      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="logo">
            <div class="logo-mark">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="7" height="7" stroke="currentColor" stroke-width="1.2"/>
                <rect x="10" y="1" width="7" height="7" stroke="currentColor" stroke-width="1.2"/>
                <rect x="1" y="10" width="7" height="7" stroke="currentColor" stroke-width="1.2"/>
                <rect x="10" y="10" width="7" height="7" fill="currentColor"/>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-name">TASK<span class="logo-ai">AI</span></span>
              <span class="logo-version">v2.1.0</span>
            </div>
          </div>

          <div class="sidebar-divider"></div>

          <nav class="nav">
            <button class="nav-item" [class.active]="activeView() === 'dashboard'" (click)="setView('dashboard')">
              <span class="nav-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="0.5" y="0.5" width="5" height="5" stroke="currentColor"/>
                  <rect x="8.5" y="0.5" width="5" height="5" stroke="currentColor"/>
                  <rect x="0.5" y="8.5" width="5" height="5" stroke="currentColor"/>
                  <rect x="8.5" y="8.5" width="5" height="5" fill="currentColor" stroke="currentColor"/>
                </svg>
              </span>
              <span class="nav-label">DASHBOARD</span>
              <span class="nav-indicator" *ngIf="activeView() === 'dashboard'"></span>
            </button>

            <button class="nav-item" [class.active]="activeView() === 'tasks'" (click)="setView('tasks')">
              <span class="nav-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="0.5" y="0.5" width="13" height="13" stroke="currentColor"/>
                  <path d="M3 7l2.5 2.5L11 4" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </span>
              <span class="nav-label">TASKS</span>
            </button>

            <button class="nav-item" [class.active]="activeView() === 'insights'" (click)="setView('insights'); loadInsights()">
              <span class="nav-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 13V8M5 13V5M9 13V2M13 13V6" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </span>
              <span class="nav-label">INSIGHTS</span>
              <span class="nav-badge" *ngIf="insights().length > 0">{{ insights().length }}</span>
            </button>

            <button class="nav-item" [class.active]="activeView() === 'standup'" (click)="setView('standup'); loadStandup()">
              <span class="nav-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="0.5" y="2.5" width="13" height="11" stroke="currentColor"/>
                  <path d="M0.5 5.5h13M4.5 0.5v4M9.5 0.5v4" stroke="currentColor"/>
                </svg>
              </span>
              <span class="nav-label">STANDUP</span>
            </button>
          </nav>
        </div>

        <div class="sidebar-bottom">
          <div class="role-block">
            <span class="block-label">DEV ROLE</span>
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

          <div class="sidebar-divider"></div>

          <div class="user-block">
            <div class="user-avatar">{{ currentRole().charAt(0).toUpperCase() }}</div>
            <div class="user-info">
              <span class="user-name">{{ roleUsers[currentRole()].name }}</span>
              <span class="user-role">{{ currentRole() | uppercase }}</span>
            </div>
            <div class="connection-dot" [class.online]="backendOnline()"></div>
          </div>
        </div>
      </aside>

      <main class="main">
        <header class="header">
          <div class="header-left">
            <div class="breadcrumb">
              <span class="breadcrumb-root">TASKAI</span>
              <span class="breadcrumb-sep">/</span>
              <span class="breadcrumb-current">{{ activeView() | uppercase }}</span>
            </div>
            <div class="header-date">{{ today }}</div>
          </div>
          <div class="header-right">
            <div class="status-chip" [class.online]="backendOnline()">
              <span class="chip-dot"></span>
              <span class="chip-text">{{ backendOnline() ? 'CONNECTED' : 'OFFLINE' }}</span>
            </div>
            <div class="header-time">{{ currentTime() }}</div>
          </div>
        </header>

        <div class="metrics-bar" *ngIf="activeView() === 'dashboard'">
          <div class="metric" *ngFor="let m of metricsList(); let i = index" [style.animation-delay]="(i * 80) + 'ms'">
            <span class="metric-num">{{ m.value }}</span>
            <span class="metric-label">{{ m.label }}</span>
            <div class="metric-bar-fill" [style.width]="m.pct + '%'"></div>
          </div>
        </div>

        <div class="content">
          <ng-container *ngIf="activeView() === 'dashboard'">
            <div class="dashboard-grid">
              <section class="panel task-panel">
                <div class="panel-header">
                  <span class="panel-title">ACTIVE TASKS</span>
                  <span class="panel-count">{{ tasks().length }}</span>
                </div>
                <div class="task-feed">
                  <div class="task-row" *ngFor="let t of tasks(); let i = index" [style.animation-delay]="(i * 40) + 'ms'">
                    <div class="task-left">
                      <div class="task-status-bar" [attr.data-status]="t.status"></div>
                      <div class="task-info">
                        <span class="task-title">{{ t.title }}</span>
                        <span class="task-sub">{{ t.category }} · {{ t.assignee?.name ?? '—' }}</span>
                      </div>
                    </div>
                    <div class="task-right">
                      <span class="task-id">{{ t.id }}</span>
                      <span class="task-status-tag" [attr.data-status]="t.status">{{ t.status }}</span>
                    </div>
                  </div>
                  <div class="task-empty" *ngIf="tasks().length === 0">
                    <span>LOADING TASK FEED...</span>
                  </div>
                </div>
              </section>

              <section class="panel insights-preview-panel">
                <div class="panel-header">
                  <span class="panel-title">SIGNAL FEED</span>
                  <button class="panel-action" (click)="setView('insights'); loadInsights()">VIEW ALL →</button>
                </div>
                <div class="signal-list">
                  <div class="signal-row" *ngFor="let ins of insights().slice(0,4)" [attr.data-severity]="ins.severity">
                    <div class="signal-bar"></div>
                    <p class="signal-msg">{{ ins.message }}</p>
                  </div>
                  <div class="signal-empty" *ngIf="insights().length === 0">
                    <span>NO ANOMALIES DETECTED</span>
                  </div>
                </div>
              </section>
            </div>
          </ng-container>

          <ng-container *ngIf="activeView() === 'insights'">
            <div class="view-header">
              <h1 class="view-title">INTELLIGENCE FEED</h1>
              <button class="refresh-btn" (click)="loadInsights()">REFRESH</button>
            </div>
            <div class="insights-grid">
              <div class="insight-card" *ngFor="let ins of insights(); let i = index" [attr.data-severity]="ins.severity" [style.animation-delay]="(i * 60) + 'ms'">
                <div class="insight-card-top">
                  <span class="insight-type">{{ ins.type | uppercase }}</span>
                  <span class="insight-sev">{{ ins.severity | uppercase }}</span>
                </div>
                <p class="insight-msg">{{ ins.message }}</p>
                <div class="insight-tasks" *ngIf="ins.taskIds?.length">
                  <span class="task-ref" *ngFor="let id of ins.taskIds.slice(0,3)">{{ id }}</span>
                </div>
                <div class="insight-metric" *ngIf="ins.metric">
                  <span class="metric-current">{{ ins.metric.current }}</span>
                  <span class="metric-sep">/</span>
                  <span class="metric-baseline">{{ ins.metric.baseline }} {{ ins.metric.unit }}</span>
                </div>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="activeView() === 'standup'">
            <div class="view-header">
              <h1 class="view-title">DAILY STANDUP</h1>
              <button class="refresh-btn" (click)="loadStandup()">GENERATE</button>
            </div>
            <div class="standup-card" *ngIf="standup(); else noStandup">
              <div class="standup-content" [innerHTML]="standup()"></div>
            </div>
            <ng-template #noStandup>
              <div class="empty-view">
                <span class="empty-label">CLICK GENERATE TO PULL TODAY'S STANDUP</span>
              </div>
            </ng-template>
          </ng-container>

          <ng-container *ngIf="activeView() === 'tasks'">
            <div class="view-header">
              <h1 class="view-title">TASK REGISTRY</h1>
            </div>
            <div class="task-table">
              <div class="table-head">
                <span>ID</span><span>TITLE</span><span>CATEGORY</span><span>ASSIGNEE</span><span>STATUS</span>
              </div>
              <div class="table-row" *ngFor="let t of tasks(); let i = index" [style.animation-delay]="(i * 30) + 'ms'">
                <span class="col-id">{{ t.id }}</span>
                <span class="col-title">{{ t.title }}</span>
                <span class="col-cat">{{ t.category }}</span>
                <span class="col-assignee">{{ t.assignee?.name ?? '—' }}</span>
                <span class="col-status" [attr.data-status]="t.status">{{ t.status }}</span>
              </div>
            </div>
          </ng-container>
        </div>
      </main>
    </div>

    <task-chat-panel (taskSelected)="onTaskSelected($event)"></task-chat-panel>
  `,
  styles: [
    `
      .shell {
        display: flex;
        height: 100vh;
        overflow: hidden;
        background: var(--bg-void);
        opacity: 0;
        transition: opacity var(--duration-slow) var(--ease-sharp);
      }

      .shell.loaded { opacity: 1; }

      .scanline {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, var(--amber), transparent);
        opacity: 0.15;
        animation: scanline 8s linear infinite;
        pointer-events: none;
        z-index: 100;
      }

      .sidebar {
        width: 200px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: var(--bg-base);
        border-right: 1px solid var(--border);
        padding: 0;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) both;
      }

      .sidebar-top {
        display: flex;
        flex-direction: column;
      }

      .sidebar-bottom {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px 16px;
        border-bottom: 1px solid var(--border);
      }

      .logo-mark {
        color: var(--amber);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: filter var(--duration-mid) var(--ease-sharp);
      }

      .logo:hover .logo-mark {
        filter: drop-shadow(0 0 6px var(--amber-glow));
      }

      .logo-name {
        font-family: var(--font-display);
        font-size: 18px;
        letter-spacing: 0.05em;
        color: var(--text-primary);
        display: block;
        line-height: 1;
      }

      .logo-ai { color: var(--amber); }

      .logo-version {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        display: block;
        margin-top: 2px;
      }

      .sidebar-divider {
        height: 1px;
        background: var(--border);
        margin: 0;
      }

      .nav {
        display: flex;
        flex-direction: column;
        padding: 12px 8px;
        gap: 2px;
      }

      .nav-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 8px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.1em;
        cursor: pointer;
        text-align: left;
        width: 100%;
        border-radius: var(--radius-sm);
        transition: all var(--duration-fast) var(--ease-sharp);
      }

      .nav-item:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      .nav-item.active {
        color: var(--amber);
        background: var(--amber-dim);
      }

      .nav-icon {
        flex-shrink: 0;
        display: flex;
      }

      .nav-label { flex: 1; }

      .nav-indicator {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--amber);
        box-shadow: 0 0 6px var(--amber);
        animation: amberPulse 2s infinite;
      }

      .nav-badge {
        font-size: 9px;
        background: var(--amber);
        color: #000;
        padding: 1px 5px;
        border-radius: var(--radius-sm);
        font-weight: 500;
      }

      .role-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .block-label {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--text-muted);
      }

      .role-pills {
        display: flex;
        gap: 4px;
      }

      .role-pill {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.06em;
        padding: 3px 7px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: all var(--duration-fast) var(--ease-sharp);
      }

      .role-pill:hover {
        border-color: var(--border-strong);
        color: var(--text-primary);
      }

      .role-pill.active {
        border-color: var(--amber);
        color: var(--amber);
        background: var(--amber-dim);
      }

      .user-block {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .user-avatar {
        width: 26px;
        height: 26px;
        border: 1px solid var(--amber-border);
        color: var(--amber);
        font-family: var(--font-display);
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: box-shadow var(--duration-mid) var(--ease-sharp);
      }

      .user-avatar:hover {
        box-shadow: 0 0 8px var(--amber-glow);
      }

      .user-name {
        display: block;
        font-size: 11px;
        font-weight: 400;
        color: var(--text-primary);
        font-family: var(--font-body);
      }

      .user-role {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        letter-spacing: 0.08em;
      }

      .connection-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--text-muted);
        margin-left: auto;
        flex-shrink: 0;
        transition: all var(--duration-mid) ease;
      }

      .connection-dot.online {
        background: var(--success);
        box-shadow: 0 0 6px var(--success);
        animation: amberPulse 3s infinite;
      }

      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) 80ms both;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 28px;
        border-bottom: 1px solid var(--border);
        background: var(--bg-base);
        flex-shrink: 0;
      }

      .breadcrumb {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        color: var(--text-muted);
      }

      .breadcrumb-sep { margin: 0 6px; }

      .breadcrumb-current { color: var(--amber); }

      .header-date {
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 2px;
        font-family: var(--font-mono);
      }

      .header-right {
        display: flex;
        align-items: center;
      }

      .status-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.1em;
        padding: 4px 10px;
        border: 1px solid var(--border);
        color: var(--text-muted);
      }

      .status-chip.online {
        border-color: rgba(76, 175, 121, 0.3);
        color: var(--success);
      }

      .chip-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
      }

      .status-chip.online .chip-dot { animation: amberPulse 2s infinite; }

      .header-time {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--amber);
        margin-left: 16px;
        min-width: 48px;
        text-align: right;
      }

      .metrics-bar {
        display: flex;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .metric {
        flex: 1;
        padding: 14px 24px;
        border-right: 1px solid var(--border);
        position: relative;
        overflow: hidden;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) both;
        transition: background var(--duration-fast) ease;
      }

      .metric:last-child { border-right: none; }

      .metric:hover { background: var(--bg-surface); }

      .metric-num {
        display: block;
        font-family: var(--font-mono);
        font-size: 26px;
        font-weight: 300;
        color: var(--text-primary);
        line-height: 1;
        animation: countUp 400ms var(--ease-sharp) both;
      }

      .metric-label {
        display: block;
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--text-muted);
        margin-top: 4px;
      }

      .metric-bar-fill {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--amber);
        opacity: 0.4;
        transition: width 800ms var(--ease-sharp);
      }

      .metric:first-child .metric-num { color: var(--amber); }

      .content {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 16px;
        height: 100%;
      }

      .panel {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) both;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .panel-title {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.15em;
        color: var(--text-muted);
      }

      .panel-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--amber);
      }

      .panel-action {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.08em;
        color: var(--amber);
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        transition: opacity var(--duration-fast);
      }

      .panel-action:hover { opacity: 0.7; }

      .task-feed {
        overflow-y: auto;
        flex: 1;
      }

      .task-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-bottom: 1px solid var(--border-subtle);
        animation: fadeSlideUp var(--duration-mid) var(--ease-sharp) both;
        transition: background var(--duration-fast);
      }

      .task-row:hover { background: var(--bg-hover); }

      .task-row:last-child { border-bottom: none; }

      .task-left {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
      }

      .task-status-bar {
        width: 2px;
        height: 32px;
        flex-shrink: 0;
        background: var(--text-muted);
      }

      [data-status="In Progress"] .task-status-bar,
      [data-status="In Progress"].task-status-bar {
        background: var(--amber);
        box-shadow: 0 0 6px var(--amber-glow);
      }

      [data-status="Done"] .task-status-bar,
      [data-status="Done"].task-status-bar { background: var(--success); }

      [data-status="Blocked"] .task-status-bar,
      [data-status="Blocked"].task-status-bar { background: var(--danger); }

      .task-info { overflow: hidden; }

      .task-title {
        display: block;
        font-size: 12px;
        font-weight: 400;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 280px;
      }

      .task-sub {
        font-size: 10px;
        color: var(--text-muted);
        font-family: var(--font-mono);
      }

      .task-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        flex-shrink: 0;
      }

      .task-id {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--amber);
        letter-spacing: 0.05em;
      }

      .task-status-tag {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.06em;
        padding: 2px 6px;
        border: 1px solid var(--border);
        color: var(--text-muted);
      }

      [data-status="In Progress"].task-status-tag {
        border-color: var(--amber-border);
        color: var(--amber);
      }

      [data-status="Done"].task-status-tag {
        border-color: rgba(76, 175, 121, 0.3);
        color: var(--success);
      }

      [data-status="Blocked"].task-status-tag {
        border-color: rgba(224, 82, 82, 0.3);
        color: var(--danger);
      }

      .task-empty,
      .signal-empty {
        padding: 32px 16px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        letter-spacing: 0.1em;
      }

      .signal-list {
        padding: 8px 0;
        overflow-y: auto;
        flex: 1;
      }

      .signal-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--border-subtle);
        transition: background var(--duration-fast);
      }

      .signal-row:hover { background: var(--bg-hover); }

      .signal-row:last-child { border-bottom: none; }

      .signal-bar {
        width: 2px;
        height: 36px;
        flex-shrink: 0;
      }

      [data-severity="info"] .signal-bar { background: var(--info); }

      [data-severity="warning"] .signal-bar {
        background: var(--amber);
        box-shadow: 0 0 6px var(--amber-glow);
      }

      [data-severity="critical"] .signal-bar {
        background: var(--danger);
        box-shadow: 0 0 6px rgba(224, 82, 82, 0.4);
      }

      .signal-msg {
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-secondary);
      }

      .view-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }

      .view-title {
        font-family: var(--font-display);
        font-size: 32px;
        letter-spacing: 0.05em;
        color: var(--text-primary);
      }

      .refresh-btn {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        padding: 7px 16px;
        border: 1px solid var(--amber-border);
        background: var(--amber-dim);
        color: var(--amber);
        cursor: pointer;
        transition: all var(--duration-fast);
      }

      .refresh-btn:hover {
        background: var(--amber);
        color: #000;
      }

      .insights-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
      }

      .insight-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        padding: 16px;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) both;
        transition: border-color var(--duration-fast), background var(--duration-fast);
      }

      .insight-card:hover { background: var(--bg-elevated); }

      [data-severity="critical"].insight-card { border-left: 2px solid var(--danger); }
      [data-severity="warning"].insight-card { border-left: 2px solid var(--amber); }
      [data-severity="info"].insight-card { border-left: 2px solid var(--info); }

      .insight-card-top {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .insight-type {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--text-muted);
      }

      .insight-sev {
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.08em;
      }

      [data-severity="critical"] .insight-sev { color: var(--danger); }
      [data-severity="warning"] .insight-sev { color: var(--amber); }
      [data-severity="info"] .insight-sev { color: var(--info); }

      .insight-msg {
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-secondary);
        margin-bottom: 10px;
      }

      .insight-tasks {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .task-ref {
        font-family: var(--font-mono);
        font-size: 9px;
        padding: 2px 6px;
        border: 1px solid var(--amber-border);
        color: var(--amber);
        letter-spacing: 0.04em;
      }

      .insight-metric {
        margin-top: 8px;
        font-family: var(--font-mono);
        font-size: 11px;
      }

      .metric-current {
        color: var(--text-primary);
        font-size: 16px;
      }

      .metric-sep {
        color: var(--text-muted);
        margin: 0 4px;
      }

      .metric-baseline { color: var(--text-muted); }

      .standup-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        padding: 28px 32px;
        animation: fadeSlideUp var(--duration-slow) var(--ease-sharp) both;
        max-width: 720px;
      }

      .standup-content {
        font-size: 13px;
        line-height: 1.8;
        color: var(--text-secondary);
      }

      .standup-content h2 {
        font-family: var(--font-display);
        font-size: 18px;
        color: var(--text-primary);
        margin: 20px 0 8px;
        letter-spacing: 0.05em;
      }

      .standup-content h2:first-child { margin-top: 0; }

      .standup-content ul { padding-left: 16px; }
      .standup-content li { margin: 4px 0; }

      .task-table {
        background: var(--bg-surface);
        border: 1px solid var(--border);
      }

      .table-head {
        display: grid;
        grid-template-columns: 100px 1fr 140px 140px 120px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--border);
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--text-muted);
      }

      .table-row {
        display: grid;
        grid-template-columns: 100px 1fr 140px 140px 120px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--border-subtle);
        font-size: 12px;
        animation: fadeSlideUp var(--duration-mid) var(--ease-sharp) both;
        transition: background var(--duration-fast);
      }

      .table-row:hover { background: var(--bg-hover); }

      .table-row:last-child { border-bottom: none; }

      .col-id {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--amber);
      }

      .col-cat,
      .col-assignee {
        font-size: 11px;
        color: var(--text-secondary);
        font-family: var(--font-mono);
      }

      .col-status {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.06em;
      }

      [data-status="In Progress"].col-status { color: var(--amber); }
      [data-status="Done"].col-status { color: var(--success); }
      [data-status="Blocked"].col-status { color: var(--danger); }

      .empty-view {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        color: var(--text-muted);
        border: 1px solid var(--border);
      }

      @media (max-width: 1180px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 880px) {
        .sidebar {
          width: 166px;
        }

        .table-head,
        .table-row {
          grid-template-columns: 90px 1fr 120px 120px 100px;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, AfterViewInit {
  roles = ['admin', 'viewer', 'owner'] as const;
  currentRole = signal<string>(localStorage.getItem('mockUser') ?? 'admin');
  activeView = signal<string>('dashboard');
  backendOnline = signal(false);
  loaded = signal(false);
  tasks = signal<Task[]>([]);
  insights = signal<Insight[]>([]);
  standup = signal<string | null>(null);
  currentTime = signal<string>('');
  metricsList = signal<{ value: string; label: string; pct: number }[]>([]);

  today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();

  roleUsers: Record<string, { name: string }> = {
    admin: { name: 'Jane Admin' },
    viewer: { name: 'Bob Viewer' },
    owner: { name: 'Carol Owner' }
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.startClock();
    this.checkBackend();
    this.loadTasks();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.loaded.set(true), 50);
  }

  private startClock(): void {
    const tick = () => {
      const now = new Date();
      this.currentTime.set(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      );
    };

    tick();
    setInterval(tick, 1000);
  }

  checkBackend(): void {
    this.http.get('/chat/history?limit=1').subscribe({
      next: () => this.backendOnline.set(true),
      error: () => this.backendOnline.set(false)
    });
  }

  loadTasks(): void {
    this.http.get<{ insights: Insight[] }>('/insights').subscribe({
      next: (res) => {
        this.insights.set(res.insights ?? []);
        this.backendOnline.set(true);
      },
      error: () => undefined
    });

    this.http.get('/chat/history?limit=1').subscribe({
      next: () => {
        this.tasks.set([
          {
            id: 'task-0031',
            title: 'OAuth migration — finalize token refresh flow',
            status: 'In Progress',
            category: 'Work → Engineering',
            assignee: { name: 'Jane' }
          },
          {
            id: 'task-0027',
            title: 'Ship new dashboard layout v2',
            status: 'Done',
            category: 'Work → Design',
            assignee: { name: 'Alex' }
          },
          {
            id: 'task-0044',
            title: 'API Refactor — v2 endpoints',
            status: 'In Progress',
            category: 'Work → Engineering',
            assignee: { name: 'Dave' }
          },
          {
            id: 'task-0038',
            title: 'Patch XSS vulnerability in comments',
            status: 'Done',
            category: 'Work → Security',
            assignee: { name: 'Jane' }
          },
          {
            id: 'task-0041',
            title: 'Database migration — schema v3',
            status: 'Blocked',
            category: 'Work → Infra',
            assignee: { name: 'Bob' }
          },
          {
            id: 'task-0019',
            title: 'Write unit tests for auth module',
            status: 'To Do',
            category: 'Work → Engineering',
            assignee: { name: 'Alex' }
          }
        ]);
        this.updateMetrics();
      }
    });
  }

  private updateMetrics(): void {
    const currentTasks = this.tasks();
    const total = currentTasks.length;
    const inProgress = currentTasks.filter((task) => task.status === 'In Progress').length;
    const done = currentTasks.filter((task) => task.status === 'Done').length;
    const blocked = currentTasks.filter((task) => task.status === 'Blocked').length;
    this.metricsList.set([
      { value: String(total), label: 'TOTAL TASKS', pct: 100 },
      { value: String(inProgress), label: 'IN PROGRESS', pct: total ? (inProgress / total) * 100 : 0 },
      { value: String(done), label: 'COMPLETED', pct: total ? (done / total) * 100 : 0 },
      { value: String(blocked), label: 'BLOCKED', pct: total ? (blocked / total) * 100 : 0 }
    ]);
  }

  loadInsights(): void {
    this.http.get<{ insights: Insight[] }>('/insights').subscribe({
      next: (res) => {
        this.insights.set(res.insights ?? []);
        this.backendOnline.set(true);
      },
      error: () => undefined
    });
  }

  loadStandup(): void {
    this.standup.set(null);
    this.http.get<{ markdown: string }>('/reports/standup').subscribe({
      next: (res) => this.standup.set(this.mdToHtml(res.markdown)),
      error: () => undefined
    });
  }

  setView(view: string): void {
    this.activeView.set(view);
  }

  switchRole(role: string): void {
    this.currentRole.set(role);
    localStorage.setItem('mockUser', role);
    this.loadTasks();
    this.insights.set([]);
  }

  onTaskSelected(taskId: string): void {
    console.log('Task selected:', taskId);
  }

  private mdToHtml(md: string): string {
    if (!md) {
      return '';
    }

    return md
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '<br><br>');
  }
}
