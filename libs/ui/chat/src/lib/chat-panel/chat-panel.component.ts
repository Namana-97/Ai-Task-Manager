import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { ChatService } from '../chat.service';
import { ChatChunk, ChatMessage } from '../models';

@Component({
  selector: 'task-chat-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="chat-fab" [class.panel-open]="open()" type="button" (click)="toggle()" aria-label="Open chat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 10h8M8 14h5M5 19l2.5-3H19a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2v3Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/>
      </svg>
    </button>

    <aside class="chat-panel" [class.open]="open()">
      <header class="chat-header">
        <div>
          <div class="chat-header-title">TASK CHAT</div>
          <div class="chat-header-sub">PRECISION TERMINAL / LIVE RAG</div>
        </div>
        <div class="chat-header-actions">
          <button class="header-btn" type="button" [disabled]="streaming()" (click)="clear()">CLEAR</button>
          <button class="header-btn" type="button" (click)="toggle()">CLOSE</button>
        </div>
      </header>

      <section class="messages">
        <div class="suggested-prompts" *ngIf="messages().length === 0">
          <button type="button" class="prompt-chip" *ngFor="let prompt of prompts" (click)="send(prompt)">
            {{ prompt }}
          </button>
        </div>

        <div class="message-block" *ngFor="let message of messages()">
          <div class="message-user" *ngIf="message.role === 'user'">
            <div class="bubble">{{ message.content }}</div>
          </div>

          <div class="message-assistant" *ngIf="message.role === 'assistant'">
            <div class="bubble">
              <div class="assistant-label">ASSISTANT</div>
              <div class="assistant-content">
                <ng-container *ngIf="message.content; else typingState">
                  {{ message.content }}
                  <span class="cursor" *ngIf="message.streaming"></span>
                </ng-container>
                <ng-template #typingState>
                  <span class="typing-indicator" *ngIf="message.streaming">
                    <span></span><span></span><span></span>
                  </span>
                </ng-template>
              </div>
            </div>

            <div class="sources-row" *ngIf="message.sources?.length">
              <button
                type="button"
                class="source-card"
                *ngFor="let source of message.sources"
                (click)="taskSelected.emit(source.taskId)">
                <span class="source-id">{{ source.taskId }}</span>
                <span class="source-title">{{ source.title }}</span>
                <span class="source-sim">{{ formatSimilarity(source.similarity) }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="chat-input-area">
        <textarea
          class="chat-textarea"
          rows="1"
          [disabled]="streaming()"
          [value]="draft()"
          (input)="draft.set(extractValue($event))"
          (keydown.enter)="handleEnter($event)"
          placeholder="Ask about tasks, blockers, trends, or status..."></textarea>
        <button class="send-btn" type="button" [disabled]="streaming() || !draft().trim()" (click)="submitDraft()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 12h12M12 4l8 8-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
          </svg>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .chat-panel {
      position: fixed;
      right: 0; top: 0; bottom: 0;
      width: 400px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent), var(--bg-base);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform var(--duration-slow) var(--ease-sharp);
      z-index: 200;
      box-shadow: -14px 0 28px rgba(0, 0, 0, 0.22);
    }
    .chat-panel.open { transform: translateX(0); }

    .chat-fab {
      position: fixed;
      bottom: 28px; right: 28px;
      width: 48px; height: 48px;
      background: var(--bg-elevated);
      border: 1px solid var(--amber-border);
      color: var(--amber);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 199;
      transition: transform var(--duration-mid) var(--ease-sharp), background-color var(--duration-mid) var(--ease-sharp), box-shadow var(--duration-mid) var(--ease-sharp), border-color var(--duration-mid) var(--ease-sharp);
      box-shadow: 0 4px 16px rgba(0,0,0,0.34);
    }
    .chat-fab.panel-open { right: 428px; }
    .chat-fab:hover {
      background: var(--amber-dim);
      box-shadow: 0 8px 20px rgba(240, 165, 0, 0.16);
      transform: translateY(-1px);
    }

    .chat-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .chat-header-title {
      font-family: var(--font-display);
      font-size: 16px;
      letter-spacing: 0.08em;
      color: var(--text-primary);
    }
    .chat-header-sub {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--amber);
      letter-spacing: 0.1em;
      margin-top: 1px;
    }
    .chat-header-actions { display: flex; gap: 6px; }
    .header-btn {
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.08em;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      padding: 6px 8px;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), opacity 180ms var(--ease-sharp);
    }
    .header-btn:hover {
      border-color: var(--amber-border);
      color: var(--amber);
      background: var(--amber-dim);
    }
    .header-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .message-user { display: flex; justify-content: flex-end; }
    .message-user .bubble {
      background: rgba(240, 165, 0, 0.16);
      border: 1px solid var(--amber-border);
      color: var(--text-primary);
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.6;
      align-self: flex-end;
      max-width: 85%;
      animation: fadeSlideUp 180ms var(--ease-sharp) both;
    }

    .message-assistant .bubble {
      background: rgba(255, 255, 255, 0.015);
      border: 1px solid var(--border-subtle);
      padding: 10px 12px;
      align-self: flex-start;
      width: 100%;
      animation: fadeSlideUp 180ms var(--ease-sharp) both;
    }
    .assistant-label {
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.1em;
      color: var(--amber);
      margin-bottom: 6px;
      display: flex; align-items: center; gap: 6px;
    }
    .assistant-label::before {
      content: '';
      width: 12px; height: 1px;
      background: var(--amber);
      opacity: 0.5;
    }
    .assistant-content {
      font-size: 13px;
      line-height: 1.7;
      color: rgba(232, 230, 224, 0.78);
      white-space: pre-wrap;
    }
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 16px;
    }
    .typing-indicator span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(240, 165, 0, 0.7);
      animation: fadeIn 500ms var(--ease-sharp) infinite alternate;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 120ms; }
    .typing-indicator span:nth-child(3) { animation-delay: 240ms; }
    .cursor {
      display: inline-block;
      width: 8px; height: 14px;
      background: var(--amber);
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: blink 0.9s step-end infinite;
    }

    .sources-row {
      display: flex; gap: 6px;
      overflow-x: auto; padding: 8px 0 2px;
      scrollbar-width: none;
    }
    .source-card {
      flex-shrink: 0;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      padding: 7px 10px;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), transform 180ms var(--ease-sharp);
      animation: fadeIn 200ms var(--ease-sharp) both;
      text-align: left;
    }
    .source-card:hover {
      border-color: var(--amber-border);
      background: var(--amber-dim);
      transform: translateY(-1px);
    }
    .source-id {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--amber);
      letter-spacing: 0.05em;
      display: block;
    }
    .source-title {
      font-size: 10px;
      color: var(--text-secondary);
      display: block;
      margin-top: 2px;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .source-sim {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 3px;
      display: block;
    }

    .suggested-prompts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 16px;
    }
    .prompt-chip {
      padding: 10px 12px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 11px;
      font-family: var(--font-body);
      text-align: left;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), color 180ms var(--ease-sharp), transform 180ms var(--ease-sharp);
      line-height: 1.4;
    }
    .prompt-chip:hover {
      border-color: var(--amber-border);
      color: var(--amber);
      background: var(--amber-dim);
      transform: translateY(-1px);
    }

    .chat-input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
    }
    .chat-textarea {
      flex: 1;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 13px;
      padding: 10px 12px;
      resize: none;
      min-height: 40px;
      max-height: 120px;
      line-height: 1.5;
      transition: border-color var(--duration-fast), box-shadow var(--duration-fast), background-color var(--duration-fast);
      border-radius: 0;
      outline: none;
    }
    .chat-textarea:focus {
      border-color: var(--amber-border);
      box-shadow: 0 0 0 1px rgba(240, 165, 0, 0.14);
      background: rgba(255, 255, 255, 0.02);
    }
    .chat-textarea::placeholder { color: var(--text-muted); }
    .chat-textarea:disabled { opacity: 0.45; cursor: not-allowed; }
    .send-btn {
      width: 38px; height: 38px;
      background: var(--amber-dim);
      border: 1px solid var(--amber-border);
      color: var(--amber);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform 160ms var(--ease-sharp), background-color 160ms var(--ease-sharp), color 160ms var(--ease-sharp), opacity 160ms var(--ease-sharp);
    }
    .send-btn:hover { background: var(--amber); color: #000; transform: translateY(-1px); }
    .send-btn:active { transform: translateY(0); }
    .send-btn:disabled { opacity: 0.3; pointer-events: none; }

    @media (max-width: 640px) {
      .chat-panel {
        width: 100vw;
      }

      .chat-fab.panel-open {
        right: 28px;
      }

      .suggested-prompts {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatPanelComponent {
  private readonly chatService = inject(ChatService);

  readonly open = signal(false);
  readonly streaming = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly prompts = [
    'What did I finish last week?',
    'What tasks are overdue?',
    'Show tasks in progress',
    'Generate the standup report'
  ];

  @Output() taskSelected = new EventEmitter<string>();

  toggle(): void {
    this.open.update((current) => !current);
  }

  clear(): void {
    this.messages.set([]);
    this.chatService.clearConversation();
  }

  send(message: string): void {
    this.open.set(true);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true
    };

    this.messages.update((current) => [...current, userMessage, assistantMessage]);
    this.chatService.pushContext(userMessage);
    this.streaming.set(true);
    this.draft.set('');

    this.chatService
      .sendMessage(message)
      .pipe(finalize(() => this.streaming.set(false)))
      .subscribe({
        next: (chunk) => this.applyChunk(assistantMessage.id, chunk),
        error: () => this.failMessage(assistantMessage.id)
      });
  }

  submitDraft(): void {
    const message = this.draft().trim();
    if (!message) {
      return;
    }
    this.send(message);
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.submitDraft();
    }
  }

  extractValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  formatSimilarity(similarity: number): string {
    return `${Math.round(similarity * 100)}% match`;
  }

  private applyChunk(messageId: string, chunk: ChatChunk): void {
    this.messages.update((current) =>
      current.map((entry) => {
        if (entry.id !== messageId) {
          return entry;
        }
        if (chunk.type === 'chunk') {
          return { ...entry, content: `${entry.content}${chunk.content ?? ''}` };
        }
        if (chunk.type === 'error') {
          return {
            ...entry,
            content: chunk.error ?? 'Unable to reach the chat backend.',
            streaming: false
          };
        }
        if (chunk.type === 'sources') {
          return { ...entry, sources: chunk.sources, streaming: true };
        }
        return { ...entry, streaming: false };
      })
    );

    if (chunk.type === 'done') {
      const completed = this.messages().find((entry) => entry.id === messageId);
      if (completed) {
        this.chatService.pushContext(completed);
      }
    }
  }

  private failMessage(messageId: string): void {
    this.messages.update((current) =>
      current.map((entry) =>
        entry.id === messageId
          ? {
              ...entry,
              content: 'The request failed before the assistant could respond.',
              streaming: false
            }
          : entry
      )
    );
  }
}
