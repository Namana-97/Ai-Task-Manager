import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'atm-suggested-prompts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid">
      <button type="button" class="chip" *ngFor="let prompt of prompts" (click)="promptSelected.emit(prompt)">
        {{ prompt }}
      </button>
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .chip {
        border: 1px solid rgba(0, 229, 255, 0.28);
        background: rgba(0, 229, 255, 0.08);
        color: #dffcff;
        border-radius: 999px;
        padding: 10px 12px;
        text-align: left;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuggestedPromptsComponent {
  readonly prompts = [
    'What did I finish last week?',
    'Show overdue tasks',
    "Summarise my team's progress",
    "What's blocking the current sprint?"
  ];

  @Output() promptSelected = new EventEmitter<string>();
}
