import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Observer, Subject } from 'rxjs';
import { ChatChunk, ChatMessage, HistoryPage } from './models';
import { CHAT_API_BASE_URL } from './tokens';

interface IntentResponse {
  type: 'query' | 'create_task' | 'update_task' | 'delete_task' | 'status_report' | 'unknown';
  confidence: number;
  parameters?: Record<string, unknown>;
  requiresConfirmation: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(CHAT_API_BASE_URL);
  private readonly contextWindow = signal<ChatMessage[]>([]);

  sendMessage(message: string, pendingIntent?: unknown): Observable<ChatChunk> {
    const subject = new Subject<ChatChunk>();
    void this.dispatchMessage(message, subject, pendingIntent as IntentResponse | undefined);
    return subject.asObservable();
  }

  getHistory(cursor?: string): Observable<HistoryPage> {
    return this.http.get<HistoryPage>(`${this.apiBase}/chat/history`, {
      params: cursor ? { before: cursor } : {}
    });
  }

  clearConversation(): void {
    this.contextWindow.set([]);
  }

  pushContext(message: ChatMessage): void {
    this.contextWindow.update((current) => [...current, message].slice(-10));
  }

  private async dispatchMessage(
    message: string,
    subject: Subject<ChatChunk>,
    pendingIntent?: IntentResponse
  ): Promise<void> {
    try {
      if (pendingIntent) {
        await this.executeIntent(pendingIntent, subject);
        return;
      }

      const intent = await this.classifyIntent(message);
      if (intent && intent.type !== 'query' && intent.type !== 'unknown') {
        if (intent.requiresConfirmation) {
          subject.next({
            type: 'confirmation',
            confirmationMessage: buildConfirmationMessage(intent),
            pendingIntent: intent
          });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }
        await this.executeIntent(intent, subject);
        return;
      }

      await this.streamChat(message, subject);
    } catch (error) {
      if (this.shouldUseMockChat() || isNetworkError(error)) {
        await this.streamMockResponse(subject);
        return;
      }

      subject.next({ type: 'error', error: getDisplayErrorMessage(error) });
      subject.complete();
    }
  }

  private async classifyIntent(message: string): Promise<IntentResponse | null> {
    const response = await fetch(`${this.apiBase}/intents/classify`, {
      method: 'POST',
      headers: this.requestHeaders(),
      body: JSON.stringify({
        message,
        conversationHistory: this.contextWindow()
          .slice(-10)
          .map(({ role, content }) => ({ role, content }))
      })
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as IntentResponse;
  }

  private async executeIntent(intent: IntentResponse, subject: Subject<ChatChunk>): Promise<void> {
    const response = await fetch(`${this.apiBase}/intents/execute`, {
      method: 'POST',
      headers: this.requestHeaders(),
      body: JSON.stringify({ intent })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Task action failed.'));
    }

    const payload = (await response.json()) as { message?: string };
    subject.next({ type: 'chunk', content: payload.message ?? 'Task action completed.' });
    subject.next({ type: 'done' });
    subject.complete();
  }

  private async streamChat(message: string, subject: Subject<ChatChunk>): Promise<void> {
    const response = await fetch(`${this.apiBase}/chat/ask`, {
      method: 'POST',
      headers: this.requestHeaders(),
      body: JSON.stringify({
        message,
        stream: true,
        conversationHistory: this.contextWindow()
          .slice(-10)
          .map(({ role, content }) => ({ role, content }))
      })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Chat request failed.'));
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      const json = (await response.json()) as { answer: string; sources?: ChatChunk['sources'] };
      subject.next({ type: 'chunk', content: json.answer });
      if (json.sources?.length) {
        subject.next({ type: 'sources', sources: json.sources });
      }
      subject.next({ type: 'done' });
      subject.complete();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Streaming not supported by this response');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        subject.next({ type: 'done' });
        subject.complete();
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      emitEvents(buffer, subject, (remaining) => {
        buffer = remaining;
      });
    }
  }

  private async streamMockResponse(subject: Subject<ChatChunk>): Promise<void> {
    const answer =
      'You finished 4 tasks last week, with the strongest throughput in UX and Platform work. The most visible completions were [task-0005], [task-0009], [task-0011], and [task-0014].';
    const sources = [
      { taskId: 'task-0005', title: 'Ship keyboard navigation for task drawer', similarity: 0.93 },
      { taskId: 'task-0011', title: 'Tune notification digest batching job', similarity: 0.88 }
    ];

    for (const token of answer.split(' ')) {
      subject.next({ type: 'chunk', content: `${token} ` });
      await new Promise((resolve) => setTimeout(resolve, 24));
    }

    subject.next({ type: 'sources', sources });
    subject.next({ type: 'done' });
    subject.complete();
  }

  private requestHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dev-stub-token',
      'X-Mock-User': localStorage.getItem('mockUser') ?? 'admin'
    };
  }

  private shouldUseMockChat(): boolean {
    return (
      localStorage.getItem('USE_MOCK_CHAT') === 'true' ||
      new URLSearchParams(globalThis.location?.search ?? '').get('mockChat') === 'true'
    );
  }
}

function emitEvents(
  buffer: string,
  subscriber: Observer<ChatChunk>,
  setRemainder: (value: string) => void
): void {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.replace(/^data:\s*/, '').trim();
    if (!line) {
      continue;
    }
    if (line === '[DONE]') {
      subscriber.next({ type: 'done' });
      subscriber.complete();
      continue;
    }
    try {
      const payload = JSON.parse(line) as {
        type: 'chunk' | 'sources';
        content?: string;
        sources?: ChatChunk['sources'];
        requiresConfirmation?: boolean;
        confirmationMessage?: string;
        pendingIntent?: unknown;
      };
      if (payload.requiresConfirmation && payload.confirmationMessage) {
        subscriber.next({
          type: 'confirmation',
          confirmationMessage: payload.confirmationMessage,
          pendingIntent: payload.pendingIntent ?? null
        });
        subscriber.next({ type: 'done' });
        subscriber.complete();
        continue;
      }
      subscriber.next(payload);
    } catch {
      continue;
    }
  }
  setRemainder(remainder);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /Failed to fetch|NetworkError|HTTP 0/i.test(error.message);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const defaultMessage = mapStatusToMessage(response.status, fallback);

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { message?: string | string[]; error?: string };
      const rawMessage = Array.isArray(payload.message)
        ? payload.message.join(' ')
        : payload.message ?? payload.error;
      return normalizeErrorMessage(response.status, rawMessage, defaultMessage);
    }

    const text = await response.text();
    return normalizeErrorMessage(response.status, text, defaultMessage);
  } catch {
    return defaultMessage;
  }
}

function buildConfirmationMessage(intent: IntentResponse): string {
  const label =
    (typeof intent.parameters?.['title'] === 'string' && intent.parameters['title']) ||
    (typeof intent.parameters?.['taskId'] === 'string' && intent.parameters['taskId']) ||
    'this task';

  return `Confirm: ${intent.type.replace(/_/g, ' ')} "${label}"?`;
}

function normalizeErrorMessage(status: number, message: string | undefined, fallback: string): string {
  const trimmed = message?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (status === 429 || /quota|rate limit|too many requests/i.test(trimmed)) {
    return 'Gemini quota exceeded. Try again later or switch to a different API key/project.';
  }

  if (trimmed.length > 220) {
    return fallback;
  }

  return trimmed;
}

function mapStatusToMessage(status: number, fallback: string): string {
  if (status === 429) {
    return 'Gemini quota exceeded. Try again later or switch to a different API key/project.';
  }

  if (status >= 500) {
    return 'The backend hit an internal error while processing this request.';
  }

  if (status === 401 || status === 403) {
    return 'You are not authorized to perform this action.';
  }

  return fallback;
}

function getDisplayErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to reach backend. Is the API running?';
}
