# Operations

## Runtime Model
The app runs as a long-lived local service.

## Auto-Start Strategy on Linux
Use a systemd user service so the process starts when the user session starts.

## Boot Catch-Up Rule
On startup:
- check each route
- if current time is past the configured send time
- and no successful send exists for that route for today
- then send one catch-up quote immediately
- record a catch-up event

This is mandatory because a PC is not a data center, despite what people tell themselves after buying one more SSD.

## Logging
Use structured logs with levels:
- info
- warn
- error
- debug

Log these events:
- startup
- migration run
- source sync start and end
- quote approved and rejected
- route fired
- quote selected
- send success and failure
- reconnect attempts
- catch-up execution

## Recovery
If transport disconnects:
- retry with bounded exponential backoff
- keep scheduler alive
- fail closed rather than duplicate-send

If DB check fails:
- stop send operations
- emit clear error

Operational backup/restore commands:
- `backup-db` writes a consistent SQLite backup file.
- `restore-db <backupPath> --yes` restores from backup and creates a pre-restore safety backup automatically.
- Restore should be executed with the long-lived service stopped.

## Safe Sending Defaults
- one quote per route per day
- one successful send per route/local-day enforced in DB, not only in scheduler logic
- cooldown window enabled by default
- quiet hours configurable
- dry-run mode available

## Suggested Default Config
- send_time_local: 09:00
- cooldown_days_per_target: 45
- global_same_day_duplicate_block: true
- source_sync_interval_hours: 24
- browser_fetch_timeout_seconds: 45
- max_retry_attempts: 5
