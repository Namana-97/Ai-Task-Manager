-- Run this only if switching from OpenAI (1536-dim) to local (384-dim) embeddings.
-- WARNING: this drops and recreates the task_vectors vector column and index.
-- Skip this migration if you are starting fresh with 384-dimensional embeddings.

ALTER TABLE task_vectors DROP COLUMN vector;
ALTER TABLE task_vectors ADD COLUMN vector vector(384) NOT NULL;

DROP INDEX IF EXISTS task_vectors_vector_idx;
CREATE INDEX ON task_vectors USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
