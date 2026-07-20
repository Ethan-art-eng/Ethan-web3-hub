CREATE TABLE IF NOT EXISTS lesson_progress (
  email TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, lesson_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS lesson_progress_email_idx ON lesson_progress(email, updated_at);
