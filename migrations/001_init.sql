PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('static_url','transcript','local_text','manual')),
  url_or_path TEXT NOT NULL,
  fetch_mode TEXT NOT NULL CHECK (fetch_mode IN ('direct','browser','auto')),
  priority INTEGER NOT NULL DEFAULT 100,
  allowed_themes_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_started_at TEXT NOT NULL,
  run_finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  fetch_mode_used TEXT NOT NULL CHECK (fetch_mode_used IN ('direct','browser')),
  raw_hash TEXT,
  notes TEXT,
  FOREIGN KEY (source_id) REFERENCES sources (id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  quote_hash TEXT NOT NULL,
  confidence REAL NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('candidate','approved','review','rejected')),
  theme_json TEXT NOT NULL DEFAULT '[]',
  tone TEXT NOT NULL DEFAULT 'neutral',
  first_seen_at TEXT NOT NULL,
  last_reviewed_at TEXT,
  last_sent_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_approved_hash_unique
  ON quotes (quote_hash)
  WHERE state = 'approved';

CREATE INDEX IF NOT EXISTS idx_quotes_state ON quotes (state);
CREATE INDEX IF NOT EXISTS idx_quotes_last_sent_at ON quotes (last_sent_at);

CREATE TABLE IF NOT EXISTS quote_aliases (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  alias_text TEXT NOT NULL,
  alias_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_aliases_hash ON quote_aliases (alias_hash);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  schedule_cron TEXT NOT NULL,
  timezone TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','group')),
  target_ref TEXT NOT NULL,
  allowed_authors_json TEXT NOT NULL DEFAULT '[]',
  allowed_themes_json TEXT NOT NULL DEFAULT '[]',
  cooldown_days INTEGER NOT NULL,
  quiet_hours_json TEXT NOT NULL DEFAULT '[]',
  allow_same_quote_global_same_day INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS send_events (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  quote_id TEXT,
  target_resolved_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  local_day TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  was_catchup INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (route_id) REFERENCES routes (id),
  FOREIGN KEY (quote_id) REFERENCES quotes (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_send_events_route_day_success_unique
  ON send_events (route_id, local_day)
  WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_send_events_quote_day_success
  ON send_events (quote_id, local_day, status);

CREATE TABLE IF NOT EXISTS app_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('debug','info','warn','error')),
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_events_type_time ON app_events (event_type, event_time);
