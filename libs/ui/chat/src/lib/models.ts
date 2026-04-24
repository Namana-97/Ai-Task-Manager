export interface SourceReference {
  taskId: string;
  title: string;
  similarity: number;
  excerpt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  createdAt: string;
  streaming?: boolean;
  isHistorical?: boolean;
}

export interface ChatChunk {
  type: 'chunk' | 'sources' | 'done' | 'error' | 'confirmation';
  content?: string;
  sources?: SourceReference[];
  error?: string;
  confirmationMessage?: string;
  pendingIntent?: unknown;
}

export interface HistoryPage {
  messages: ChatMessage[];
  nextCursor: string | null;
}
