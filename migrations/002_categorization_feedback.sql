CREATE TABLE IF NOT EXISTS categorization_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'edited', 'rejected')),
  suggested_category TEXT,
  suggested_priority TEXT,
  suggested_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_category TEXT,
  final_priority TEXT,
  final_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categorization_feedback_created_at_idx
  ON categorization_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS categorization_feedback_decision_idx
  ON categorization_feedback (decision);
