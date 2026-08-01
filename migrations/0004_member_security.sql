CREATE TABLE IF NOT EXISTS member_login_attempts (
  attempt_key TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS member_login_attempts_updated_idx
ON member_login_attempts(updated_at);

PRAGMA optimize;
