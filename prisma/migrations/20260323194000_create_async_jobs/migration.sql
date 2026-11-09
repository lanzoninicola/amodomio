CREATE TABLE async_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 100,
  dedupe_key TEXT UNIQUE,
  payload JSONB NOT NULL,
  result JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMP(3),
  locked_at TIMESTAMP(3),
  locked_by TEXT,
  error_message TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP(3),
  finished_at TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX async_jobs_status_run_after_priority_created_at_idx
  ON async_jobs (status, run_after, priority, created_at);

CREATE INDEX async_jobs_type_status_created_at_idx
  ON async_jobs (type, status, created_at);
