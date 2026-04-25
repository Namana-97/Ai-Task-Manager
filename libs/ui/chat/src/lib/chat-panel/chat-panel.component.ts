import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { finalize } from 'rxjs';
import { ChatService } from '../chat.service';
import { ChatChunk, ChatMessage, SourceReference } from '../models';

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

        <ng-container *ngFor="let message of messages(); let i = index">
          <div class="assistant-label" *ngIf="shouldShowHistoryDivider(i)">EARLIER</div>

          <div class="message-block">
          <div class="message-user" *ngIf="message.role === 'user'">
            <div class="bubble">{{ message.content }}</div>
          </div>

          <div class="message-assistant" *ngIf="message.role === 'assistant'">
            <div class="bubble">
              <div class="assistant-topline">
                <div class="assistant-label">ASSISTANT</div>
                <div class="message-meta">
                  <span *ngIf="message.isHistorical">HISTORY</span>
                  <span>{{ formatTime(message.createdAt) }}</span>
                </div>
              </div>
              <div class="assistant-content prose">
                <ng-container *ngIf="message.content; else typingState">
                  <div [innerHTML]="renderAssistantContent(message)"></div>
                  <span class="cursor" *ngIf="message.streaming"></span>
                </ng-container>
                <ng-template #typingState>
                  <div class="typing-shell" *ngIf="message.streaming">
                    <span class="typing-indicator"><span></span><span></span><span></span></span>
                    <span class="typing-copy">Retrieving task context and composing response…</span>
                  </div>
                </ng-template>
              </div>
            </div>

            <div class="sources-block" *ngIf="message.sources?.length">
              <div class="sources-label">REFERENCES</div>
              <div class="sources-row">
                <button
                  type="button"
                  class="source-card"
                  *ngFor="let source of message.sources"
                  (click)="onTaskSelected(source.taskId)">
                  <span class="source-id">{{ source.taskId }}</span>
                  <span class="source-title">{{ source.title }}</span>
                  <span class="source-sim">{{ formatSimilarity(source.similarity) }}</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </ng-container>
      </section>

      <div class="message-assistant" *ngIf="pendingConfirmation()">
        <div class="bubble">
          <div class="assistant-label">CONFIRM ACTION</div>
          <div class="assistant-content">{{ pendingConfirmation()!.message }}</div>
        </div>
        <div class="chat-header-actions">
          <button class="header-btn" type="button" (click)="confirmAction()">CONFIRM</button>
          <button class="header-btn" type="button" (click)="cancelAction()">CANCEL</button>
        </div>
      </div>

      <div class="chat-input-area">
        <textarea
          class="chat-textarea"
          rows="1"
          [disabled]="streaming() || !!pendingConfirmation()"
          [value]="draft()"
          (input)="draft.set(extractValue($event))"
          (keydown.enter)="handleEnter($event)"
          placeholder="Ask about tasks, blockers, trends, or status..."></textarea>
        <button class="send-btn" type="button" [disabled]="streaming() || !!pendingConfirmation() || !draft().trim()" (click)="submitDraft()">
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
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent), var(--bg-base);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform var(--duration-slow) var(--ease-sharp);
      z-index: 200;
      box-shadow: -18px 0 42px rgba(0, 0, 0, 0.46);
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
      box-shadow: var(--shadow-card);
      border-radius: 12px;
    }
    .chat-fab.panel-open { right: 428px; }
    .chat-fab:hover {
      background: rgba(245, 185, 66, 0.14);
      box-shadow: 0 12px 28px rgba(245, 185, 66, 0.18);
      transform: translateY(-1px);
    }

    .chat-header {
      padding: 20px 20px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .chat-header-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-primary);
      text-transform: uppercase;
    }
    .chat-header-sub {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      color: var(--amber);
      letter-spacing: 0.1em;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .chat-header-actions { display: flex; gap: 6px; }
    .header-btn {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), opacity 180ms var(--ease-sharp);
      border-radius: 999px;
      text-transform: uppercase;
    }
    .header-btn:hover {
      border-color: var(--amber-border);
      color: #0B0F14;
      background: var(--amber);
    }
    .header-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

    .message-user { display: flex; justify-content: flex-end; }
    .message-user .bubble {
      background: rgba(245, 185, 66, 0.14);
      border: 1px solid var(--amber-border);
      color: var(--text-primary);
      padding: 12px 16px;
      font-size: 13px;
      line-height: 1.6;
      align-self: flex-end;
      max-width: 85%;
      animation: fadeSlideUp 180ms var(--ease-sharp) both;
      border-radius: 16px 16px 6px 16px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    }

    .message-assistant .bubble {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent), var(--bg-surface);
      border: 1px solid var(--border);
      padding: 16px 18px;
      align-self: flex-start;
      width: 100%;
      animation: fadeSlideUp 180ms var(--ease-sharp) both;
      border-radius: 16px;
      box-shadow: var(--shadow-card);
    }
    .assistant-topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .assistant-label {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 700;
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
    .message-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
      white-space: nowrap;
    }
    .assistant-content {
      font-size: 14px;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.82);
    }
    .prose {
      color: rgba(255, 255, 255, 0.86);
    }
    .prose :first-child { margin-top: 0; }
    .prose :last-child { margin-bottom: 0; }
    .prose p {
      margin: 0 0 10px;
    }
    .prose h2,
    .prose h3 {
      margin: 14px 0 8px;
      font-family: var(--font-display);
      letter-spacing: 0.05em;
      color: var(--text-primary);
      line-height: 1;
    }
    .prose h2 {
      font-size: 20px;
    }
    .prose h3 {
      font-size: 16px;
    }
    .prose ul,
    .prose ol {
      margin: 0 0 12px 18px;
      padding: 0;
    }
    .prose li {
      margin-bottom: 6px;
    }
    .prose strong {
      color: var(--text-primary);
      font-weight: 500;
    }
    .prose code {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--amber);
      background: rgba(240, 165, 0, 0.08);
      border: 1px solid rgba(240, 165, 0, 0.12);
      padding: 1px 4px;
    }
    .prose pre {
      overflow-x: auto;
      margin: 0 0 12px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
    }
    .prose pre code {
      padding: 0;
      border: none;
      background: transparent;
      color: var(--text-primary);
    }
    .prose blockquote {
      margin: 0 0 12px;
      padding-left: 10px;
      border-left: 1px solid var(--amber-border);
      color: var(--text-secondary);
    }
    .prose a {
      color: var(--amber);
      text-decoration: none;
      border-bottom: 1px solid rgba(240, 165, 0, 0.25);
    }
    .typing-shell {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text-secondary);
    }
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 16px;
    }
    .typing-copy {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.06em;
      color: var(--text-muted);
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

    .sources-block {
      margin-top: 10px;
    }
    .sources-label {
      margin-bottom: 8px;
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.1em;
      color: var(--text-muted);
    }
    .sources-row {
      display: flex; gap: 6px;
      overflow-x: auto; padding: 0 0 2px;
      scrollbar-width: none;
    }
    .source-card {
      flex-shrink: 0;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      padding: 12px 14px;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), transform 180ms var(--ease-sharp);
      animation: fadeIn 200ms var(--ease-sharp) both;
      text-align: left;
      min-width: 176px;
      border-radius: var(--radius-md);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
    }
    .source-card:hover {
      border-color: var(--amber-border);
      background: rgba(245, 185, 66, 0.1);
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
      padding: 14px 14px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-body);
      text-align: left;
      cursor: pointer;
      transition: background-color 180ms var(--ease-sharp), border-color 180ms var(--ease-sharp), color 180ms var(--ease-sharp), transform 180ms var(--ease-sharp);
      line-height: 1.4;
      border-radius: var(--radius-md);
    }
    .prompt-chip:hover {
      border-color: var(--amber-border);
      color: var(--amber);
      background: var(--amber-dim);
      transform: translateY(-1px);
    }

    .chat-input-area {
      padding: 16px 20px 20px;
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
      border-radius: 12px;
      outline: none;
    }
    .chat-textarea:focus {
      border-color: var(--amber-border);
      box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.12);
      background: rgba(255, 255, 255, 0.025);
    }
    .chat-textarea::placeholder { color: var(--text-muted); }
    .chat-textarea:disabled { opacity: 0.45; cursor: not-allowed; }
    .send-btn {
      width: 38px; height: 38px;
      background: var(--amber);
      border: 1px solid var(--amber-border);
      color: #0B0F14;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform 160ms var(--ease-sharp), background-color 160ms var(--ease-sharp), color 160ms var(--ease-sharp), opacity 160ms var(--ease-sharp);
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(245, 185, 66, 0.16);
    }
    .send-btn:hover { background: var(--amber-hover); color: #000; transform: translateY(-1px); }
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
  private readonly sanitizer = inject(DomSanitizer);

  readonly open = signal(false);
  readonly streaming = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly pendingConfirmation = signal<{ message: string; intent: unknown } | null>(null);
  readonly skipHistoryLoad = signal(readSkipHistoryPreference());
  readonly showHistoryDivider = computed(() => {
    const messages = this.messages();
    return messages.length > 0 && messages.some((message) => message.isHistorical) && messages.some((message) => !message.isHistorical);
  });
  readonly prompts = [
    'What did I finish last week?',
    'What tasks are overdue?',
    'Show tasks in progress',
    'Generate the standup report'
  ];

  @Output() taskSelected = new EventEmitter<string>();

  toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }

    this.openPanel();
  }

  openPanel(): void {
    this.open.set(true);
    if (this.messages().length === 0 && !this.skipHistoryLoad()) {
      this.loadHistory();
    }
  }

  clear(): void {
    this.messages.set([]);
    this.pendingConfirmation.set(null);
    this.skipHistoryLoad.set(true);
    writeSkipHistoryPreference(true);
    this.chatService.clearConversation();
    this.chatService.clearHistory().subscribe({
      next: () => {},
      error: () => {}
    });
  }

  send(message: string, pendingIntent?: unknown): void {
    this.openPanel();
    this.skipHistoryLoad.set(false);
    writeSkipHistoryPreference(false);
    const isConfirmation = message === '__CONFIRM__' && !!pendingIntent;
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true
    };

    if (isConfirmation) {
      this.messages.update((current) => [...current, assistantMessage]);
    } else {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      };
      this.messages.update((current) => [...current, userMessage, assistantMessage]);
      this.chatService.pushContext(userMessage);
    }

    this.pendingConfirmation.set(null);
    this.streaming.set(true);
    this.draft.set('');

    this.chatService
      .sendMessage(message, pendingIntent)
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

  formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  renderAssistantContent(message: ChatMessage): SafeHtml {
    const rendered = marked.parse(this.formatAssistantMarkdown(message), {
      async: false,
      breaks: true
    });
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(String(rendered)));
  }

  onTaskSelected(taskId: string): void {
    this.taskSelected.emit(taskId);
  }

  confirmAction(): void {
    const pending = this.pendingConfirmation();
    if (!pending) {
      return;
    }

    this.pendingConfirmation.set(null);
    this.send('__CONFIRM__', pending.intent);
  }

  cancelAction(): void {
    this.pendingConfirmation.set(null);
    this.messages.update((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Action cancelled.',
        createdAt: new Date().toISOString()
      }
    ]);
  }

  shouldShowHistoryDivider(index: number): boolean {
    if (!this.showHistoryDivider()) {
      return false;
    }

    const current = this.messages()[index];
    const previous = this.messages()[index - 1];
    return Boolean(current && !current.isHistorical && previous?.isHistorical);
  }

  private loadHistory(): void {
    this.chatService.getHistory().subscribe({
      next: (page) => {
        if (!page?.messages?.length) {
          return;
        }

        const historical = [...page.messages].reverse().map((message) => ({
          ...message,
          isHistorical: true
        }));
        this.messages.set(historical);
        this.chatService.clearConversation();
        for (const message of historical) {
          this.chatService.pushContext(message);
        }
      },
      error: () => {}
    });
  }

  private applyChunk(messageId: string, chunk: ChatChunk): void {
    if (chunk.type === 'confirmation') {
      this.pendingConfirmation.set({
        message: chunk.confirmationMessage ?? 'Confirm this action?',
        intent: chunk.pendingIntent ?? null
      });
      this.streaming.set(false);
      this.messages.update((current) => current.filter((entry) => entry.id !== messageId));
      return;
    }

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
      if (completed?.content) {
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

  private decorateTaskIds(content: string): string {
    return content.replace(/\[(task-\d+)\]/gi, '`[$1]`');
  }

  private formatAssistantMarkdown(message: ChatMessage): string {
    const content = message.content.trim();
    if (!content) {
      return '';
    }

    const normalized = this.decorateTaskIds(content);
    if (this.isPrestructuredResponse(normalized)) {
      return normalized;
    }

    if (this.isStatusStyleMessage(normalized)) {
      return `## Status\n\n${normalized}`;
    }

    const summary = this.extractSummary(normalized);
    const details = this.extractDetails(normalized, summary);
    const sections = [`## Summary\n\n${summary}`];

    if (details) {
      sections.push(`## Details\n\n${details}`);
    }

    const sourceOverview = this.buildSourceOverview(message.sources ?? []);
    if (sourceOverview) {
      sections.push(`## Key Tasks\n\n${sourceOverview}`);
    }

    return sections.join('\n\n');
  }

  private isPrestructuredResponse(content: string): boolean {
    return /(^|\n)(#{1,6}\s|[-*]\s|\d+\.\s)/m.test(content);
  }

  private isStatusStyleMessage(content: string): boolean {
    return /^(action cancelled\.|task action completed\.|created|updated|deleted|removed|generated)/i.test(
      content
    );
  }

  private extractSummary(content: string): string {
    const sentences = this.splitSentences(content);
    if (sentences.length <= 2) {
      return content;
    }

    return sentences.slice(0, 2).join(' ');
  }

  private extractDetails(content: string, summary: string): string {
    if (content === summary) {
      return '';
    }

    const remainder = content.slice(summary.length).trim();
    return remainder.replace(/^\s+/, '');
  }

  private buildSourceOverview(sources: SourceReference[]): string {
    if (!sources.length) {
      return '';
    }

    return sources
      .slice(0, 4)
      .map((source) => `- \`${source.taskId}\` ${source.title}`)
      .join('\n');
  }

  private splitSentences(content: string): string[] {
    return content
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }
}

function readSkipHistoryPreference(): boolean {
  return sessionStorage.getItem('skipChatHistoryLoad') === 'true';
}

function writeSkipHistoryPreference(value: boolean): void {
  if (value) {
    sessionStorage.setItem('skipChatHistoryLoad', 'true');
    return;
  }

  sessionStorage.removeItem('skipChatHistoryLoad');
}
