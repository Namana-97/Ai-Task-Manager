-- Migration 004: Update vector column back to 1536 dimensions for OpenAI text-embedding-3-small
-- Run this if a database was previously switched to 768-dimension Gemini embeddings.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_vectors'
    AND column_name = 'vector'
  ) THEN
    DROP INDEX IF EXISTS task_vectors_vector_idx;

    TRUNCATE TABLE task_vectors;
    ALTER TABLE task_vectors DROP COLUMN IF EXISTS vector;
    ALTER TABLE task_vectors ADD COLUMN vector vector(1536) NOT NULL;

    CREATE INDEX task_vectors_vector_idx
      ON task_vectors
      USING hnsw (vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);

    RAISE NOTICE 'task_vectors updated to 1536 dimensions (OpenAI text-embedding-3-small)';
  ELSE
    RAISE NOTICE 'task_vectors table not found — skipping dimension migration';
  END IF;
END $$;
