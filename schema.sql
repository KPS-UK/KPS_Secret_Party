CREATE TABLE IF NOT EXISTS guests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  organisation TEXT NOT NULL DEFAULT '',
  attended BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'import',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guests_email_unique_idx ON guests (LOWER(email));
