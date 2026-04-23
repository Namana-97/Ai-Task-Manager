CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE task_vectors (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  role        TEXT NOT NULL,
  vector      vector(1536) NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX ON task_vectors USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  org_id     TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  sources    JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created_at
  ON chat_messages (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS llm_audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  org_id      TEXT NOT NULL,
  input_hash  TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  latency_ms  INTEGER NOT NULL,
  flagged     BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp   TIMESTAMPTZ NOT NULL
);
