# AI Task Manager

RAG-based task management system with an AI chat interface for querying and managing tasks using natural language.

## Features

- Chat with your tasks using natural language
- Retrieve relevant tasks with embeddings and RAG
- Create, update, and delete tasks through the intent executor
- Automatically re-index task mutations into the vector store
- Track whether AI categorization suggestions were accepted, edited, or rejected
- Return user-friendly `429 Too Many Requests` responses with `Retry-After`

## How To Run

```bash
npm install
npx nx serve api-ai
npx nx serve shell
```

Primary local URLs:

- Angular shell: `http://localhost:4200`
- Nest API: `http://localhost:3333`

The shell app now runs through a real Angular/Nx workspace with proxying to the backend. The older preview server is still available as a fallback demo tool, but the intended submission flow is `nx serve api-ai` and `nx serve shell`.

## Benchmarks

Run the local benchmark scripts from the repo root:

```bash
npm run bench:retrieval
npm run bench:embedding
```

What they measure:

- `bench:retrieval`: deterministic in-memory retrieval latency over synthetic task documents
- `bench:embedding`: deterministic local embedding throughput over synthetic task documents

Example output shape:

```text
Dataset size: 200 tasks
Runs: 25
Average retrieval latency: <ms>
P95 retrieval latency: <ms>

Documents embedded: 120
Embedding duration: <ms>
Throughput: <docs/sec>
```

The benchmark scripts only use synthetic data in `scripts/benchmarks` and do not modify application state.

## Demo Support

The repo includes a recording checklist and a narration-friendly walkthrough in [docs/demo-walkthrough.md](/Users/namanakanchan/Ai-Task-Manager/docs/demo-walkthrough.md:1).

Suggested demo flow:

1. Ask a retrieval question in the shell chat.
2. Show a follow-up query with source citations.
3. Trigger a task mutation through the intent flow and mention that re-indexing is automatic.
4. Mention categorization feedback tracking and the local benchmark scripts.
5. Mention that rate-limited chat requests now return `429` with `Retry-After`.

## Notes

- `migrations/001_pgvector_tasks.sql` sets up vector storage.
- `migrations/002_categorization_feedback.sql` adds categorization feedback storage for accepted, edited, and rejected suggestions.
- `npx nx test shell` runs the Angular shell tests.
- `npx nx build shell --configuration=development` produces the Angular build in `dist/apps/shell`.
