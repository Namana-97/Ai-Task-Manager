import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { ChatService } from '../chat.service';
import { ChatChunk, ChatMessage } from '../models';
import { ChatInputComponent } from '../chat-input/chat-input.component';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';
import { SourceCardComponent } from '../source-card/source-card.component';
import { SuggestedPromptsComponent } from '../suggested-prompts/suggested-prompts.component';

@Component({
  selector: 'task-chat-panel',
  standalone: true,
  imports: [
    CommonModule,
    ChatInputComponent,
    MessageBubbleComponent,
    SourceCardComponent,
    SuggestedPromptsComponent
  ],
  template: `
    <button class="fab" type="button" (click)="toggle()">AI</button>

    <aside class="panel" [class.open]="open()">
      <header class="header">
        <div>
          <div class="eyebrow">Secure AI Assistant</div>
          <h2>Task Chat</h2>
        </div>
        <div class="actions">
          <button type="button" (click)="clear()">Clear conversation</button>
          <button type="button" (click)="toggle()">Close</button>
        </div>
      </header>

      <section class="messages">
        <atm-suggested-prompts
          *ngIf="messages().length === 0"
          (promptSelected)="send($event)"></atm-suggested-prompts>

        <div class="message-group" *ngFor="let message of messages()">
          <atm-message-bubble [message]="message"></atm-message-bubble>
          <atm-source-card
            *ngIf="message.role === 'assistant' && message.sources?.length"
            [sources]="message.sources ?? null"
            (taskSelected)="taskSelected.emit($event)"></atm-source-card>
        </div>
      </section>

      <atm-chat-input [disabled]="streaming()" (submitted)="send($event)"></atm-chat-input>
    </aside>
  `,
  styles: [
    `
      :host {
        font-family: "DM Sans", sans-serif;
      }

      .fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 56px;
        height: 56px;
        border: 0;
        border-radius: 50%;
        background: #00e5ff;
        color: #04131e;
        font: 800 14px/1 "JetBrains Mono", monospace;
        box-shadow: 0 16px 40px rgba(0, 229, 255, 0.24);
      }

      .panel {
        position: fixed;
        top: 0;
        right: 0;
        width: min(420px, 100vw);
        height: 100vh;
        background:
          radial-gradient(circle at top right, rgba(0, 229, 255, 0.12), transparent 30%),
          linear-gradient(180deg, #101827 0%, #0d1117 100%);
        color: #ffffff;
        border-left: 1px solid rgba(255, 255, 255, 0.08);
        transform: translateX(100%);
        transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
        display: flex;
        flex-direction: column;
        padding: 20px;
      }

      .panel.open {
        transform: translateX(0);
      }

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 16px;
      }

      .eyebrow {
        color: #00e5ff;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
      }

      h2 {
        margin: 8px 0 0;
        font-size: 28px;
      }

      .actions {
        display: flex;
        gap: 8px;
      }

      .actions button {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        background: transparent;
        color: #d7faff;
        padding: 8px 12px;
      }

      .messages {
        flex: 1;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 8px 2px 18px;
      }

      .message-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      @media (max-width: 640px) {
        .panel {
          width: 100vw;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatPanelComponent {
  private readonly chatService = inject(ChatService);

  readonly open = signal(false);
  readonly streaming = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
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

    this.chatService
      .sendMessage(message)
      .pipe(finalize(() => this.streaming.set(false)))
      .subscribe({
        next: (chunk) => this.applyChunk(assistantMessage.id, chunk),
        error: () => this.failMessage(assistantMessage.id)
      });
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
          ? { ...entry, content: 'Unable to reach the chat backend.', streaming: false }
          : entry
      )
    );
  }
}
