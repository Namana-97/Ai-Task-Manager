import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'atm-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" [class.disabled]="disabled">
      <textarea
        [(ngModel)]="value"
        rows="1"
        maxlength="500"
        [disabled]="disabled"
        (keydown)="onKeyDown($event)"
        placeholder="Ask about tasks, blockers, trends, or status..."></textarea>
      <div class="meta">
        <span *ngIf="500 - value.length < 50">{{ 500 - value.length }} characters left</span>
        <button type="button" (click)="submit()" [disabled]="disabled || !value.trim()">Send</button>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 14px;
      }

      .disabled {
        opacity: 0.6;
      }

      textarea {
        width: 100%;
        min-height: 48px;
        max-height: 140px;
        resize: vertical;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        color: #ffffff;
        padding: 14px;
        font: 500 14px/1.5 "DM Sans", sans-serif;
      }

      .meta {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
      }

      button {
        border: 0;
        border-radius: 999px;
        background: #00e5ff;
        color: #03131f;
        padding: 8px 14px;
        font-weight: 700;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatInputComponent {
  @Input() disabled = false;
  @Output() submitted = new EventEmitter<string>();
  value = '';

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  submit(): void {
    const value = this.value.trim();
    if (!value) {
      return;
    }
    this.submitted.emit(value);
    this.value = '';
  }
}
