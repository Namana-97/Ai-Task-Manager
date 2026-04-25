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
    <div class="editor-panel">
      <div class="editor-header">
        <span class="editor-title">{{ mode === 'create' ? 'Create Task' : 'Edit Task' }}</span>
        <button class="editor-action" type="button" (click)="cancelled.emit()">Close</button>
      </div>

      <div class="editor-grid">
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

      <div class="editor-footer">
        <button class="editor-action primary" type="button" (click)="submit()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    .editor-panel {
      margin-bottom: 16px;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .editor-header,
    .editor-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .editor-title {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.12em;
      color: var(--amber);
    }
    .editor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .editor-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }
    .editor-field input,
    .editor-field select,
    .editor-field textarea {
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 10px 12px;
      font: inherit;
      outline: none;
      resize: vertical;
    }
    .editor-field input:focus,
    .editor-field select:focus,
    .editor-field textarea:focus {
      border-color: var(--amber-border);
    }
    .editor-textarea textarea {
      min-height: 96px;
    }
    .editor-action {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      padding: 8px 12px;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
    }
    .editor-action.primary {
      border-color: var(--amber-border);
      background: var(--amber-dim);
      color: var(--amber);
    }
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
