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
          <code>jordan / jordan123</code>
          <code>taylor / taylor123</code>
          <code>alex / alex123</code>
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
      background: var(--bg-void);
      color: var(--text-primary);
      padding: 24px;
    }
    .login-panel {
      width: min(420px, 100%);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .login-brand {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .login-title {
      font-family: var(--font-display);
      font-size: 40px;
      letter-spacing: 0.06em;
    }
    .login-subtitle {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      color: var(--text-secondary);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .login-label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }
    .login-label input {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 10px 12px;
      font: inherit;
      outline: none;
    }
    .login-label input:focus {
      border-color: var(--amber-border);
    }
    .login-button {
      border: 1px solid var(--amber-border);
      background: var(--amber-dim);
      color: var(--amber);
      padding: 10px 12px;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.1em;
    }
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
      padding: 4px 6px;
      border: 1px solid var(--border-subtle);
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
