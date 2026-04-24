-- Migration 003: Update vector column to 768 dimensions for Gemini text-embedding-004
-- text-embedding-004 outputs 768-dimensional vectors (not 1536 like OpenAI)
-- Run this ONLY if switching from OpenAI (1536) to Gemini embeddings
-- Safe to run on a fresh database — it recreates the index correctly

DO $$
BEGIN
  -- Check current dimension
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_vectors'
    AND column_name = 'vector'
  ) THEN
    -- Drop old index
    DROP INDEX IF EXISTS task_vectors_vector_idx;

    -- Recreate column with correct dimension
    ALTER TABLE task_vectors DROP COLUMN IF EXISTS vector;
    ALTER TABLE task_vectors ADD COLUMN vector vector(768) NOT NULL DEFAULT '[0]'::vector;
    ALTER TABLE task_vectors ALTER COLUMN vector DROP DEFAULT;

    -- Recreate HNSW index for 768-dim cosine similarity
    CREATE INDEX task_vectors_vector_idx
      ON task_vectors
      USING hnsw (vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);

    RAISE NOTICE 'task_vectors updated to 768 dimensions (Gemini text-embedding-004)';
  ELSE
    RAISE NOTICE 'task_vectors table not found — skipping dimension migration';
  END IF;
END $$;
