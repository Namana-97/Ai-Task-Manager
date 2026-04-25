import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiTask } from './tasks-api.service';

export interface TaskEditorValue {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

@Component({
  selector: 'app-task-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="editor-panel rounded-xl">
      <div class="editor-header flex items-center justify-between">
        <span class="editor-title">{{ mode === 'create' ? 'Create Task' : 'Edit Task' }}</span>
        <button class="editor-action" type="button" (click)="cancelled.emit()">Close</button>
      </div>

      <div class="editor-grid grid gap-4">
        <label class="editor-field">
          <span>Title</span>
          <input [(ngModel)]="title" name="title" />
        </label>

        <label class="editor-field">
          <span>Category</span>
          <input [(ngModel)]="category" name="category" />
        </label>

        <label class="editor-field">
          <span>Status</span>
          <select [(ngModel)]="status" name="status">
            <option>Open</option>
            <option>In Progress</option>
            <option>Blocked</option>
            <option>Done</option>
            <option>To Do</option>
          </select>
        </label>

        <label class="editor-field">
          <span>Priority</span>
          <select [(ngModel)]="priority" name="priority">
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>

        <label class="editor-field">
          <span>Assignee</span>
          <input [(ngModel)]="assignee" name="assignee" />
        </label>

        <label class="editor-field">
          <span>Due Date</span>
          <input [(ngModel)]="dueDate" name="dueDate" type="date" />
        </label>
      </div>

      <label class="editor-field editor-textarea">
        <span>Description</span>
        <textarea [(ngModel)]="description" name="description"></textarea>
      </label>

      <label class="editor-field">
        <span>Tags</span>
        <input [(ngModel)]="tags" name="tags" placeholder="comma,separated,tags" />
      </label>

      <div class="editor-footer flex items-center justify-end">
        <button class="editor-action primary" type="button" (click)="submit()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    .editor-panel {
      margin-bottom: 24px;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .editor-header,
    .editor-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .editor-title {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--amber);
      text-transform: uppercase;
    }
    .editor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .editor-field {
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
    .editor-field input,
    .editor-field select,
    .editor-field textarea {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 12px 14px;
      font: inherit;
      outline: none;
      resize: vertical;
      border-radius: var(--radius-md);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
    }
    .editor-field input:focus,
    .editor-field select:focus,
    .editor-field textarea:focus {
      border-color: var(--amber-border);
      box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.12);
    }
    .editor-textarea textarea {
      min-height: 96px;
    }
    .editor-action {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      padding: 10px 14px;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .editor-action.primary {
      border-color: var(--amber-border);
      background: var(--amber);
      color: #0B0F14;
      box-shadow: 0 10px 24px rgba(245, 185, 66, 0.18);
    }
    .editor-action.primary:hover { background: var(--amber-hover); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskEditorComponent {
  @Input({ required: true }) mode: 'create' | 'edit' = 'create';
  @Input() set task(value: ApiTask | null | undefined) {
    this.title = value?.title ?? '';
    this.description = value?.description ?? '';
    this.category = value?.category ?? 'General';
    this.priority = value?.priority ?? 'Medium';
    this.status = value?.status ?? 'Open';
    this.assignee = value?.assignee?.name ?? '';
    this.dueDate = value?.dueDate?.slice(0, 10) ?? '';
    this.tags = (value?.tags ?? []).join(', ');
  }

  @Output() submitted = new EventEmitter<TaskEditorValue>();
  @Output() cancelled = new EventEmitter<void>();

  title = '';
  description = '';
  category = 'General';
  priority = 'Medium';
  status = 'Open';
  assignee = '';
  dueDate = '';
  tags = '';
  readonly saving = signal(false);

  submit(): void {
    this.submitted.emit({
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      category: this.category.trim() || undefined,
      priority: this.priority || undefined,
      status: this.status || undefined,
      assignee: this.assignee.trim() || undefined,
      dueDate: this.dueDate || undefined,
      tags: this.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    });
  }
}
