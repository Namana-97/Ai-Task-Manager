import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <div class="login-panel">
        <div class="login-brand">
          <span class="login-title">TASKAI</span>
          <span class="login-subtitle">Secure Task Management System</span>
        </div>

        <form class="login-form" (ngSubmit)="submit()">
          <label class="login-label">
            <span>Username</span>
            <input [(ngModel)]="username" name="username" type="text" autocomplete="username" required />
          </label>

          <label class="login-label">
            <span>Password</span>
            <input [(ngModel)]="password" name="password" type="password" autocomplete="current-password" required />
          </label>

          <button class="login-button" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Signing In...' : 'Sign In' }}
          </button>
        </form>

        <p class="login-error" *ngIf="error()">{{ error() }}</p>

        <div class="login-hint">
          <span>Seed users:</span>
          <code>jordan / jordan123 — Admin</code>
          <code>taylor / taylor123 — Owner</code>
          <code>alex / alex123 — Viewer</code>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at top, rgba(245, 185, 66, 0.1), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,0.02), transparent 26%),
        var(--bg-void);
      color: var(--text-primary);
      padding: 32px;
    }
    .login-panel {
      width: min(420px, 100%);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-panel);
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .login-brand {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .login-title {
      font-family: var(--font-display);
      font-size: 42px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .login-subtitle {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .login-label {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    .login-label input {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 14px 16px;
      font: inherit;
      outline: none;
      border-radius: var(--radius-md);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
    }
    .login-label input:focus {
      border-color: var(--amber-border);
      box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.12);
    }
    .login-button {
      border: 1px solid var(--amber-border);
      background: var(--amber);
      color: #0B0F14;
      padding: 12px 16px;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      border-radius: 999px;
      text-transform: uppercase;
      box-shadow: 0 10px 24px rgba(245, 185, 66, 0.18);
    }
    .login-button:hover { background: var(--amber-hover); }
    .login-button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .login-error {
      color: var(--danger);
      font-size: 12px;
    }
    .login-hint {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 11px;
      color: var(--text-secondary);
    }
    .login-hint code {
      font-family: var(--font-mono);
      background: var(--bg-elevated);
      padding: 6px 8px;
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  @Output() loggedIn = new EventEmitter<void>();

  private readonly authService = inject(AuthService);

  username = 'jordan';
  password = 'jordan123';
  submitting = signal(false);
  error = signal('');

  submit(): void {
    this.submitting.set(true);
    this.error.set('');
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.loggedIn.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('Login failed. Check your username and password.');
      }
    });
  }
}
