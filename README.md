# AI Task Manager

AI Task Manager is an end-to-end task management demo that combines:

- an Angular shell UI
- a NestJS backend API
- OpenAI-powered chat and embeddings
- pgvector-based retrieval
- intent-driven task actions
- standup and insight generation

The project is structured as an Nx monorepo and is designed to demonstrate an "AI-powered extensions" style submission rather than a finished production SaaS product.

## What This Project Does

- lets a user ask natural-language questions about tasks
- retrieves relevant tasks semantically using embeddings and pgvector
- returns grounded answers with task source references
- supports create, update, and delete task actions through intent classification
- generates standup reports
- generates anomaly and productivity insights
- stores chat history
- re-indexes tasks into the vector store when they change

## Current Status

What is working:

- OpenAI-backed chat responses
- OpenAI embeddings with `text-embedding-3-small`
- pgvector retrieval with RBAC-scoped search
- chat history API and chat history UI loading
- source references in chat responses
- confirmation flow for destructive task actions
- standup generation
- insights generation
- deterministic answers for common operational questions such as:
  - overdue tasks
  - in-progress tasks
  - recently completed tasks
  - what the current user finished last week

What is still demo/stubbed:

- the backend task repository is an in-memory seeded repository, not a persistent task table
- the shell task registry view still renders hardcoded demo rows instead of the backend seed data
- authentication is stubbed for local/demo use
- streaming in the chat UI is simulated from completed backend answers rather than true token-by-token transport

## Monorepo Structure

```text
apps/
  api-ai/        NestJS backend API
  shell/         Angular frontend shell

libs/
  ai/
    embeddings/  embedding client, document builder, vector store
    guardrails/  sanitization, canary token, output validation, rate limiting, audit
    intents/     intent classification and task action execution
    rag/         retrieval, reranking, prompt loading, LLM client
  ui/
    chat/        chat drawer UI and frontend chat service

prompts/
  v1/            versioned prompt templates

migrations/
  001_*          pgvector + chat history schema
  002_*          categorization feedback schema
  003_*          vector dimension migration for Gemini
  004_*          vector dimension migration for OpenAI
```

## Architecture

```text
Angular Shell
  -> Chat UI / Dashboard / Insights / Standup
  -> /chat/ask, /chat/history, /insights, /reports/standup, /intents/*

NestJS API
  -> JwtAuthGuard (stub auth in local mode)
  -> ChatService / ReportsService / InsightsService / IntentsController

AI Layer
  -> InputSanitiser
  -> EmbeddingClient
  -> VectorStoreClient
  -> Rerank
  -> PromptLoader
  -> LlmClient
  -> CanaryTokenValidator
  -> AuditLogger

Storage
  -> pgvector task_vectors
  -> chat_messages
  -> categorization_feedback
```

## End-to-End Flows

### 1. RAG Chat Query

1. User asks a question in the Angular chat drawer.
2. Frontend calls `/intents/classify`.
3. If the request is a normal query, frontend calls `/chat/ask`.
4. Backend sanitizes the message and embeds the query.
5. Backend retrieves task vectors from pgvector using RBAC scope filters.
6. Results are reranked.
7. PromptLoader builds the final system prompt using retrieved task documents.
8. LlmClient calls OpenAI.
9. Backend validates output, logs the interaction, stores chat history, and returns:
   - answer text
   - task sources

### 2. Task Mutation Flow

1. User asks for a task action such as create, update, or delete.
2. Frontend calls `/intents/classify`.
3. If the action is destructive, UI shows confirmation.
4. Frontend calls `/intents/execute`.
5. Backend validates parameters and mutates the task store.
6. The changed task is re-indexed into the vector store automatically.

### 3. Standup Flow

1. User opens the Standup screen or asks for a standup report.
2. Backend groups recent tasks into completed, started, and blocked buckets.
3. PromptLoader renders the standup prompt.
4. LlmClient generates markdown.
5. Frontend displays the generated standup.

### 4. Insights Flow

1. Backend scans task data for anomalies such as:
   - stale tasks
   - throughput drop
   - overdue clusters
   - productivity patterns
2. LLM turns anomaly data into short insight cards.
3. Frontend displays the resulting insight feed.

## Feature Checklist

### Core Product

- Dashboard UI
- Tasks view
- Insights view
- Standup view
- Chat drawer
- Task source navigation from chat to task list

### AI Features

- RAG chat with semantic retrieval
- source citations
- intent classification
- task mutation through intents
- standup report generation
- anomaly / productivity insights
- categorization feedback tracking

### Guardrails

- input sanitization
- rate limiting
- canary-token leakage detection
- output validation on structured intent payloads
- audit logging

### Retrieval and Data

- OpenAI embeddings
- pgvector storage
- RBAC filtering at retrieval time
- automatic re-indexing for task mutations
- chat history persistence

## Tech Stack

### Frontend

- Angular 17
- standalone components
- SCSS
- RxJS

### Backend

- NestJS
- TypeScript
- pg / pgvector
- Zod

### AI

- OpenAI SDK
- optional provider abstraction for Gemini and Anthropic
- marked + DOMPurify for rich assistant rendering in chat

## Data Model Summary

### `task_vectors`

Stores:

- `id`
- `org_id`
- `assignee_id`
- `role`
- `vector`
- `metadata`

Metadata includes display and retrieval fields such as:

- title
- status
- category
- priority
- createdAt
- updatedAt
- dueDate
- assigneeName
- orgName
- rendered document

### `chat_messages`

Stores user and assistant messages plus sources for chat history.

### `categorization_feedback`

Stores whether AI categorization suggestions were accepted, edited, or rejected.

## RBAC Model

RBAC is enforced in retrieval before data reaches the LLM.

- `viewer`
  - only sees tasks for `org_id = orgId` and `assignee_id = userId`
- `admin`
  - sees tasks within the current org
- `owner`
  - sees tasks across `childOrgIds`

This logic lives in [libs/ai/embeddings/src/lib/vector-store-client.service.ts](libs/ai/embeddings/src/lib/vector-store-client.service.ts).

Note: local auth is still stubbed in [apps/api-ai/src/auth/jwt-auth.guard.ts](apps/api-ai/src/auth/jwt-auth.guard.ts) for demo use.

## Prompting

Prompts are versioned under `prompts/v1/`.

Current prompt set includes:

- `rag-system.txt`
- `intent-classifier.txt`
- `standup-report.txt`
- `anomaly-insights.txt`
- `smart-categorization.txt`

PromptLoader discovers prompt versions at startup and caches them in memory.

## Environment

Copy or edit `.env` for local development. The current default setup uses OpenAI.

Important variables:

```bash
LLM_PROVIDER=openai
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini

EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

VECTOR_STORE=pgvector
VECTOR_STORE_URL=postgresql://dev:dev@localhost:5432/taskdb

AUTH_STUB=true
SEED_VECTOR_STORE=true
API_PORT=3333
```

## Database Setup

The project expects Postgres with the `vector` extension available.

Base migrations:

- `migrations/001_pgvector_tasks.sql`
- `migrations/002_categorization_feedback.sql`

Dimension migrations:

- `migrations/003_vector_dimension_gemini.sql`
- `migrations/004_vector_dimension_openai.sql`

If your DB was previously migrated to Gemini dimensions and you are now using OpenAI embeddings, run:

```bash
set -a
source .env
set +a
psql "$VECTOR_STORE_URL" -f migrations/004_vector_dimension_openai.sql
```

## How To Run

### Install

```bash
pnpm install
```

If you are not using pnpm, `npm install` also works in most local setups.

### Start Backend

Recommended backend command:

```bash
npx tsx apps/api-ai/src/main.ts
```

This is the most reliable local command because it does not depend on `tsx` already being on your shell `PATH`.

### Start Frontend

```bash
npx nx serve shell
```

### Local URLs

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3333`

## Manual Test Prompts

Use these in the chat drawer:

```text
What did I finish last week?
What tasks are overdue?
Show tasks in progress
Which tasks are completed recently?
Generate the standup report
```

Expected behavior:

- grounded answers
- source cards under task-related answers
- standup returns markdown-style report content
- source-card click moves to the Tasks view

## Useful Commands

### Clear chat history

```bash
set -a
source .env
set +a
psql "$VECTOR_STORE_URL" -c "DELETE FROM chat_messages;"
```

### Restart backend if port `3333` is busy

```bash
PID=$(lsof -t -iTCP:3333 -sTCP:LISTEN); [ -n "$PID" ] && kill "$PID"
npx tsx apps/api-ai/src/main.ts
```

## Testing

Backend tests:

```bash
npx jest apps/api-ai --runInBand
```

Frontend typecheck:

```bash
./node_modules/.bin/tsc -p apps/shell/tsconfig.app.json --noEmit
```

Benchmarks:

```bash
npm run bench:retrieval
npm run bench:embedding
```

## API Surface

- `POST /chat/ask`
- `GET /chat/history`
- `POST /intents/classify`
- `POST /intents/execute`
- `GET /reports/standup`
- `GET /insights`

## Known Limitations

- shell task table is still hardcoded demo data
- backend task repository is still in-memory seeded data
- auth is stubbed for local/demo mode
- no dedicated `/tasks` REST CRUD controller yet
- "streaming" in chat is still chunked output from a completed answer

## Trade-offs

- seeded in-memory tasks make the project easy to demo locally without a full application database
- provider abstraction keeps the AI layer modular, but the current documented setup is OpenAI-first
- deterministic answers were added for common operational task questions because those are more reliable than pure semantic generation for demo data

## Demo Notes

Suggested demo flow:

1. Ask a retrieval question in chat.
2. Open a source card and jump to the task list.
3. Ask for overdue or in-progress tasks.
4. Ask for a standup report.
5. Trigger a task mutation and show the confirmation flow.

Supplemental architecture notes are also available in [README.ai.md](README.ai.md).
