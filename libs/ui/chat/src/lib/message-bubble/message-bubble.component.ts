import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChatMessage } from '../models';

@Component({
  selector: 'atm-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="bubble" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
      <div class="content" [innerHTML]="renderedContent()"></div>
      <span *ngIf="message.streaming" class="cursor">▊</span>
    </article>
  `,
  styles: [
    `
      .bubble {
        animation: slideUp 200ms ease-out;
        color: #ffffff;
        line-height: 1.55;
      }

      .user {
        margin-left: auto;
        max-width: 82%;
        border-radius: 22px;
        background: rgba(0, 229, 255, 0.15);
        padding: 14px 16px;
      }

      .assistant {
        width: 100%;
        padding: 4px 0;
      }

      .content :is(code, pre) {
        font-family: "JetBrains Mono", monospace;
      }

      .cursor {
        margin-left: 2px;
        color: #00e5ff;
        animation: blink 1s steps(2, start) infinite;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;

  constructor(private readonly sanitizer: DomSanitizer) {}

  renderedContent(): SafeHtml {
    const content = this.message.role === 'assistant' ? marked.parse(this.message.content) : this.message.content;
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(String(content)));
  }
}
