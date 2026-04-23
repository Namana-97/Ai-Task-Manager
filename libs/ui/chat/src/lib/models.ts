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
}

export interface ChatChunk {
  type: 'chunk' | 'sources' | 'done' | 'error';
  content?: string;
  sources?: SourceReference[];
  error?: string;
}

export interface HistoryPage {
  messages: ChatMessage[];
  nextCursor: string | null;
}
