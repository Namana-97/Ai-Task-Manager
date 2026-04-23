import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SourceReference } from '../models';

@Component({
  selector: 'atm-source-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row" *ngIf="sources?.length">
      <button
        type="button"
        class="card"
        *ngFor="let source of sources; index as i"
        [style.animationDelay.ms]="i * 80"
        (click)="taskSelected.emit(source.taskId)">
        <div class="id">{{ source.taskId }}</div>
        <div class="title">{{ source.title }}</div>
        <div class="badge">{{ (source.similarity * 100).toFixed(0) }}%</div>
      </button>
    </div>
  `,
  styles: [
    `
      .row {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding: 8px 0 2px;
      }

      .card {
        animation: reveal 220ms ease-out both;
        min-width: 180px;
        text-align: left;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 12px;
        color: #ffffff;
        transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
      }

      .card:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 229, 255, 0.6);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
      }

      .id {
        font: 600 12px/1 "JetBrains Mono", monospace;
        color: #00e5ff;
      }

      .title {
        margin-top: 8px;
        font: 600 14px/1.4 "DM Sans", sans-serif;
      }

      .badge {
        margin-top: 10px;
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 12px;
      }

      @keyframes reveal {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourceCardComponent {
  @Input() sources: SourceReference[] | null = null;
  @Output() taskSelected = new EventEmitter<string>();
}
