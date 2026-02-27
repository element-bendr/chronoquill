CREATE TABLE IF NOT EXISTS deferred_route_runs (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  local_day TEXT NOT NULL,
  next_attempt_at TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','done','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (route_id) REFERENCES routes (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deferred_route_runs_route_day_unique
  ON deferred_route_runs(route_id, local_day);

CREATE INDEX IF NOT EXISTS idx_deferred_route_runs_due
  ON deferred_route_runs(status, next_attempt_at);
