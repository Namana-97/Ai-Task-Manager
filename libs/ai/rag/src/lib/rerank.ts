import { SearchResult } from '@ai-task-manager/ai/embeddings';

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const keywordScore = (query: string, document: string): number => {
  const queryTerms = tokenize(query);
  const documentTerms = tokenize(document);
  if (!queryTerms.length || !documentTerms.length) {
    return 0;
  }

  const documentFrequency = documentTerms.reduce<Record<string, number>>((acc, term) => {
    acc[term] = (acc[term] ?? 0) + 1;
    return acc;
  }, {});

  const hits = queryTerms.reduce((sum, term) => sum + (documentFrequency[term] ?? 0), 0);
  return hits / queryTerms.length;
};

export function rerank(query: string, docs: SearchResult[]): SearchResult[] {
  return [...docs].sort((left, right) => {
    const leftKeywordScore = keywordScore(query, String(left.document ?? left.metadata.document ?? ''));
    const rightKeywordScore = keywordScore(query, String(right.document ?? right.metadata.document ?? ''));
    const leftScore = 0.7 * left.similarity + 0.3 * leftKeywordScore;
    const rightScore = 0.7 * right.similarity + 0.3 * rightKeywordScore;
    return rightScore - leftScore;
  });
}
