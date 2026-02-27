# History

This file is append-only and records product decisions.

## Initial Decisions
- v1 is local-first.
- v1 uses SQLite.
- v1 uses adapter-based WhatsApp transport.
- v1 uses adapter-based browser fetching.
- v1 supports daily scheduled sends.
- v1 includes boot catch-up to recover after downtime.
- v1 does not require an LLM.
- v1 allows optional offline LLM curation.

## Architectural Decisions
- Deterministic validators decide publishability.
- Browser automation is fallback-only.
- Send history drives anti-repeat behavior.
- Approved sources are explicit and curated.
- Source registry is configuration-backed, not hard-coded chaos.

## Change Logging Rules
Every meaningful change must append:
- date
- change summary
- reason
- migration impact
- rollback notes if relevant
- update this file in the same task batch as the code/doc change

## Example Entry Template
- Date:
- Change:
- Reason:
- Migration Impact:
- Rollback Notes:

## Entries
- Date: 2026-02-27
- Change: Added `send_events.local_day`, route/day success uniqueness, quote `last_sent_at`, and explicit retry/backoff config keys.
- Reason: Make anti-duplicate and recovery guarantees enforceable at DB level, not just in runtime logic.
- Migration Impact: Initial schema now includes partial/conditional unique indexes for approved quote hash and route/day send success.
- Rollback Notes: Remove new columns/indexes only with a data backfill and duplicate-audit plan first.

- Date: 2026-02-27
- Change: Implemented end-to-end v1 runtime: config loader/validation, SQLite migrations, seed bootstrap, source sync, deterministic curation, dedup, route planner, scheduler, boot catch-up, publisher, health checks, CLI commands, tests, and systemd unit.
- Reason: Deliver the full production-grade baseline defined by PRD, Architecture, and Master Prompt with no hot-path LLM dependency.
- Migration Impact: Introduced initial migration `001_init.sql` and seed records in `seeds/initial-seed.json`; no destructive migration required.
- Rollback Notes: Revert commit and restore database from backup; for data rollback, drop DB file only if this is a non-production bootstrap environment.

- Date: 2026-02-27
- Change: Added quiet-hours enforcement to publish path, scheduler same-minute duplicate trigger guard, periodic source-sync scheduling in service mode, and regression tests for quiet-hours behavior.
- Reason: Hardening pass for operational safety and duplicate-send prevention under timer jitter/reentrant callback scenarios.
- Migration Impact: No schema changes.
- Rollback Notes: Revert the hardening commit; behavior falls back to previous schedule/send execution model.

- Date: 2026-02-27
- Change: Initialized Git repository, created baseline commits, and pushed `main` to remote origin.
- Reason: Establish versioned change control and remote backup for ongoing iterative delivery.
- Migration Impact: No runtime/data migration impact.
- Rollback Notes: Git-only operation; revert commits or force-update branch only with explicit change-management approval.

- Date: 2026-02-27
- Change: Added regression coverage for global same-day duplicate behavior (blocked by default, route override allowed) and extracted/tested scheduler minute-window guard.
- Reason: Ensure anti-repeat policy and duplicate-trigger protection are explicitly verified in unit tests.
- Migration Impact: No schema changes.
- Rollback Notes: Revert associated test and scheduler guard refactor commit if rollback is required.
