# Data Schema

## Tables

### sources
Stores approved quote sources.

Columns:
- id
- name
- author
- source_type
- url_or_path
- fetch_mode
- priority
- enabled
- created_at
- updated_at

### source_runs
Stores each fetch and parse attempt.

Columns:
- id
- source_id
- run_started_at
- run_finished_at
- status
- fetch_mode_used
- raw_hash
- notes

### quotes
Stores canonical quote records.

Columns:
- id
- source_id
- author
- text
- normalized_text
- quote_hash
- confidence
- state
- theme_json
- tone
- first_seen_at
- last_reviewed_at
- last_sent_at

### quote_aliases
Stores near-duplicate or merged variants.

Columns:
- id
- quote_id
- alias_text
- alias_hash
- created_at

### routes
Stores delivery routes.

Columns:
- id
- name
- enabled
- schedule_cron
- timezone
- target_type
- target_ref
- allowed_authors_json
- allowed_themes_json
- cooldown_days
- quiet_hours_json
- allow_same_quote_global_same_day
- created_at
- updated_at

### send_events
Stores every publish attempt.

Columns:
- id
- route_id
- quote_id
- target_resolved_id
- attempted_at
- local_day
- status
- retry_count
- error_code
- error_message
- was_catchup

### app_events
Stores operational audit trail.

Columns:
- id
- event_type
- event_time
- severity
- payload_json

## Key Constraints
- quotes.quote_hash must be unique for canonical approved entries (partial unique index where `state='approved'`)
- one successful send per route per local day unless config explicitly allows more (enforced by unique index on `route_id + local_day` where status is success)
- send_events must never be silently deleted
