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
