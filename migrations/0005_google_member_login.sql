ALTER TABLE members ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS members_google_sub_idx
ON members(google_sub)
WHERE google_sub IS NOT NULL AND google_sub != '';

PRAGMA optimize;
