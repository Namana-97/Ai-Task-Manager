# Secure Task Management System

This repository is an Nx monorepo containing:

- `apps/api-ai`: NestJS backend
- `apps/shell`: Angular frontend
- `libs/ai/*`: existing AI features such as RAG, intent classification, embeddings, and guardrails

The project now supports a real secure task-management flow on top of the existing AI system:

- JWT authentication with `/auth/login`
- TypeORM-backed relational storage for users, organizations, roles, tasks, and audit logs
- RBAC-enforced `/tasks` and `/audit-log` APIs
- Angular login flow and task create/edit/delete forms
- Existing AI chat, standup, insights, embeddings, and vector retrieval preserved

## Challenge Coverage

Implemented for the secure task-management challenge:

- real JWT login
- token verification on protected endpoints
- role-based access control for `Owner`, `Admin`, and `Viewer`
- two-level organization hierarchy
- task CRUD API
- audit logging for task mutations
- persistent relational database using TypeORM + SQLite
- Angular login and task management flow
- backend tests for auth, RBAC, and task endpoints

Retained from the existing AI system:

- RAG chat
- semantic search via embeddings
- intent-driven task actions
- standup generation
- insights generation
- vector indexing on task create/update/delete

## Monorepo Layout

```text
apps/
  api-ai/                  NestJS backend
  shell/                   Angular frontend

libs/
  ai/
    embeddings/            embeddings, vector-store access
    guardrails/            sanitization, rate limiting, canary detection
    intents/               intent classification and task mutations
    rag/                   retrieval, prompts, LLM client
  ui/
    chat/                  chat drawer UI
```

The original repo naming and app names predate the challenge. The secure task-management implementation lives inside the existing workspace without removing the AI features.

## Setup

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL with `pgvector` if you want the AI/RAG features enabled

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in the values you need.

Key variables:

```bash
NODE_ENV=development
API_PORT=3333
CORE_DB_PATH=apps/api-ai/data/core.sqlite
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN_SECONDS=3600
AUTH_STUB=false

LLM_PROVIDER=openai
LLM_API_KEY=...
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=...
VECTOR_STORE=pgvector
VECTOR_STORE_URL=postgresql://dev:dev@localhost:5432/taskdb
SEED_VECTOR_STORE=true
```

### Run the Backend

```bash
set -a
source .env
set +a
npx tsx apps/api-ai/src/main.ts
```

Backend runs on:

```text
http://localhost:3333
```

### Run the Frontend

```bash
npx nx serve shell
```

Frontend runs on:

```text
http://localhost:4200
```

## Authentication Flow

### Login Endpoint

`POST /auth/login`

Example request:

```json
{
  "username": "jordan",
  "password": "jordan123"
}
```

Example response:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "user-002",
    "username": "jordan",
    "name": "Jordan Lee",
    "role": "admin",
    "orgId": "org-root",
    "orgName": "Acme Product"
  }
}
```

### Frontend Behavior

- the Angular shell shows a login screen before the dashboard
- successful login stores:
  - `authToken`
  - `authUser`
  in `localStorage`
- the HTTP interceptor attaches `Authorization: Bearer <token>` to API requests

### Seeded Users

These seeded users are available for local development:

- `alex / alex123` → Viewer
- `jordan / jordan123` → Admin
- `taylor / taylor123` → Owner
- `morgan / morgan123` → Admin in child org

## Architecture Overview

### Backend

The backend is split into two logical systems:

1. Core secure task-management system
   - TypeORM entities
   - JWT authentication
   - RBAC enforcement
   - task CRUD
   - audit logging

2. Existing AI system
   - query routing
   - RAG retrieval
   - intent classification
   - standup and insights
   - embeddings and vector search

The bridge between them is the task repository.

`TaskRepositoryStub` keeps the existing interface expected by the AI system, but its internals now use TypeORM-backed persistence. This allows the AI features to continue working without changing the RAG engine or intent flows.

### Frontend

The Angular shell keeps the existing UI layout. The main additions are:

- login page component
- task editor component for create/edit
- JWT-aware auth service and interceptor
- task registry and dashboard bound to live `/tasks` data

## Data Model

### Entities

#### Organization

- `id`
- `name`
- `parentId`

Supports a two-level hierarchy:

- root org
- child orgs

#### Role

- `name`
- `permissions`

Roles:

- `owner`
- `admin`
- `viewer`

#### User

- `id`
- `username`
- `password`
- `displayName`
- `jobTitle`
- `organizationId`
- `roleName`

#### Task

- `id`
- `title`
- `description`
- `category`
- `status`
- `priority`
- `dueDate`
- `createdAt`
- `updatedAt`
- `assigneeId`
- `organizationId`
- `tags`
- `activityLog`
- `visibilityRole`

#### AuditLog

- `id`
- `actorUserId`
- `actorName`
- `actorRole`
- `orgId`
- `action`
- `resourceType`
- `resourceId`
- `details`
- `createdAt`

### ERD

```text
Organization (parent-child)
  └── Users
        └── Role

Organization
  └── Tasks
        └── Assignee(User)

Organization
  └── AuditLog
```

### Storage Strategy

There are two storage layers:

1. Core relational data
   - SQLite via TypeORM
   - file path: `apps/api-ai/data/core.sqlite` by default

2. AI retrieval data
   - pgvector in PostgreSQL
   - used only for embeddings / semantic search / RAG

## RBAC Implementation

### Roles

- `Owner`
  - full task access across the org and child orgs
  - audit-log access
- `Admin`
  - full task access within the current org
  - audit-log access
- `Viewer`
  - read-only access
  - only tasks assigned to that user inside the current org

### Enforcement

RBAC is implemented with:

- `@Roles(...)`
- `@Permissions(...)`
- `JwtAuthGuard`
- `RbacGuard`

Protected endpoints:

- `POST /tasks`
- `GET /tasks`
- `GET /tasks/:id`
- `PUT /tasks/:id`
- `DELETE /tasks/:id`
- `GET /audit-log`

The repository also applies scope filtering on reads so that list/get operations only return data within the authenticated user’s authorized scope.

## API Documentation

### Auth

- `POST /auth/login`

### Tasks

- `GET /tasks`
  - list tasks visible to the current user
- `GET /tasks/:id`
  - get a single visible task
- `POST /tasks`
  - create a task
- `PUT /tasks/:id`
  - update a task
- `DELETE /tasks/:id`
  - delete a task

### Audit

- `GET /audit-log`
  - owner/admin only

### Existing AI Endpoints

These remain intact and continue to operate on the same task repository:

- `POST /chat/ask`
- `GET /chat/history`
- `DELETE /chat/history`
- `POST /intents/classify`
- `POST /intents/execute`
- `GET /reports/standup`
- `GET /insights`

## Audit Logging

All task mutations are written to the `AuditLog` table:

- create
- update
- delete

Each row captures:

- actor
- role
- organization
- resource
- action
- summary details

## AI Architecture

The AI system was intentionally preserved.

### Retrieval Flow

1. frontend sends a question to `/chat/ask`
2. backend may route deterministic operational queries first
3. otherwise the RAG engine:
   - sanitizes input
   - embeds the query
   - retrieves task vectors from pgvector
   - builds a grounded prompt
   - calls the LLM
   - returns answer text and sources

### Task Mutation + AI Compatibility

The AI task mutation flow still works because it uses the same repository interface:

- `TaskRepositoryStub.create()`
- `TaskRepositoryStub.update()`
- `TaskRepositoryStub.delete()`

Those methods now persist to the relational database and still trigger vector re-indexing.

### Embedding Pipeline

After create/update/delete:

- tasks are re-indexed through `TaskIndexingService`
- the vector store stays aligned with the authoritative database task state

## Frontend Notes

The existing shell layout was preserved.

New non-breaking additions:

- login page
- task create/edit form
- delete action
- JWT storage and request attachment

Existing views still work:

- Dashboard
- Tasks
- Insights
- Standup
- Chat

## Tests

### Backend

Run:

```bash
npx jest apps/api-ai --runInBand
```

Current coverage added for:

- auth login
- RBAC guard
- tasks controller behavior

### Type Check

```bash
npm run build
./node_modules/.bin/tsc -p apps/shell/tsconfig.app.json --noEmit
```

## Tradeoffs

- SQLite is used for the secure core system because it minimizes setup complexity for the challenge. PostgreSQL can replace it later without changing the controller contract.
- Passwords are seeded in plaintext for local challenge setup. Production should use bcrypt or Argon2.
- `synchronize: true` is enabled for TypeORM to simplify local setup. Production should use explicit migrations.
- Legacy stub auth is still available behind `AUTH_STUB=true` only for temporary backward compatibility with older flows.
- The AI/vector system still depends on PostgreSQL + pgvector if semantic chat features are required.

## Future Considerations

- refresh tokens and token revocation
- password hashing and password reset flow
- CSRF and stricter cookie-based auth for browser sessions
- database migrations instead of `synchronize: true`
- RBAC result caching
- more granular permission model beyond role-level permissions
- production audit-log retention policies
- drag-and-drop task interactions and richer task filters
- scaling permission checks for large org trees
