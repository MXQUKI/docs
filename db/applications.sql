-- Apply once to the isolated production or preview database before opening applications.
CREATE TABLE IF NOT EXISTS nice_applications (
  id uuid PRIMARY KEY,
  hash text NOT NULL,
  payload jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','syncing','synced','blocked')),
  record_id text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  retry_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  synced_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS nice_applications_due ON nice_applications (retry_at) WHERE state IN ('pending','syncing');
CREATE TABLE IF NOT EXISTS nice_application_rate (
  key text NOT NULL,
  bucket bigint NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (key,bucket)
);
