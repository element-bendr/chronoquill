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

- Date: 2026-02-27
- Change: Added feature-flagged optional `LLMCuratorAgent` integration for offline advisory curation (`LLM_PROVIDER_NAME=heuristic|none`) and wired `curate-quotes` to apply advisory tags/tone while preserving deterministic final state validation.
- Reason: Start Phase 7 without introducing LLM dependency in routing/scheduling/publishing hot path.
- Migration Impact: No schema changes; advisory traces recorded in `app_events` with event type `llm_curation_advisory`.
- Rollback Notes: Set `LLM_CURATION_ENABLED=false` or revert integration commit; deterministic curation continues to function unchanged.

- Date: 2026-02-27
- Change: Added manual review queue workflow with CLI commands `review-list`, `review-approve`, and `review-reject`, plus audit event logging (`review_queue_decision`) and tests.
- Reason: Complete operator-driven low-confidence review flow required for Phase 7 and prevent implicit auto-approval behavior.
- Migration Impact: No schema changes.
- Rollback Notes: Revert review queue service/CLI commit; curation pipeline still functions without manual decision commands.

- Date: 2026-02-27
- Change: Added CSV export operations with `export-send-history` and `export-review-queue` CLI commands, plus export service and tests.
- Reason: Improve observability and operational reporting for send history and manual review backlog.
- Migration Impact: No schema changes.
- Rollback Notes: Revert CSV export service/CLI changes; no data migration rollback required.

- Date: 2026-02-27
- Change: Added DB backup and restore commands (`backup-db`, `restore-db --yes`), backup/restore service, recovery runbook, and tests.
- Reason: Improve operational resilience and make rollback/recovery repeatable for local-first deployments.
- Migration Impact: No schema changes.
- Rollback Notes: Revert backup/restore service and CLI command additions; existing DB and migration behavior remain unchanged.

- Date: 2026-02-27
- Change: Implemented quiet-hours deferral queue with deferred route run persistence, minute-level deferred scheduler runner, and regression test updates.
- Reason: Ensure quiet-hours behavior defers delivery instead of dropping scheduled send opportunities.
- Migration Impact: Added migration `002_deferred_route_runs.sql` creating `deferred_route_runs` table and supporting indexes.
- Rollback Notes: Revert scheduler/publisher deferral integration and migration if required; keep backup before schema rollback.

- Date: 2026-02-27
- Change: Replaced mock/log transport with production Baileys WhatsApp transport (QR pairing, persistent auth state, target resolution, reconnect path) and switched runtime/config defaults to Baileys.
- Reason: Move from simulation transport to real WhatsApp delivery path for production use.
- Migration Impact: No schema changes; new runtime config keys added (`BAILEYS_AUTH_DIR`, `BAILEYS_PRINT_QR`, `BAILEYS_BROWSER_NAME`).
- Rollback Notes: Revert transport adapter changes and restore previous transport configuration if needed.

- Date: 2026-02-27
- Change: Integrated Vercel `agent-browser` as a production browser worker adapter (`BROWSER_WORKER_ADAPTER=agent-browser`) with provider/headless/timeout config and runtime selection.
- Reason: Enable real browser-based quote capture for dynamic sources via the existing browser abstraction.
- Migration Impact: No schema changes; added runtime config keys (`AGENT_BROWSER_PROVIDER`, `AGENT_BROWSER_HEADLESS`, `AGENT_BROWSER_NAV_TIMEOUT_MS`).
- Rollback Notes: Switch adapter to `noop` or revert `agent-browser` integration changes if browser runtime is unavailable.

- Date: 2026-02-27
- Change: Repaired WhatsApp pairing flow for CLI ping verification, added QR image output path for easier scanning (`BAILEYS_QR_IMAGE_PATH`), and revalidated live sends to direct JID and `PUNTERS` group ID.
- Reason: Resolve terminal QR readability and confirm end-to-end production delivery path with explicit target IDs during operator testing.
- Migration Impact: No schema changes; added runtime config key `BAILEYS_QR_IMAGE_PATH`.
- Rollback Notes: Revert QR file output/config additions; pairing can still proceed through terminal QR rendering only.

- Date: 2026-02-27
- Change: Added production inbound WhatsApp capture pipeline with Baileys `messages.upsert` handling, persisted `inbound_messages` table, app event logging (`inbound_message_received`), and new CLI inspection command `inbound-list`.
- Reason: Enable operator verification of real group/user replies and close observability gap for live WhatsApp conversations.
- Migration Impact: Added migration `003_inbound_messages.sql` creating `inbound_messages` plus unique/indexed lookup paths.
- Rollback Notes: Revert inbound capture wiring and migration if needed; outbound publishing flow remains unchanged.

- Date: 2026-02-27
- Change: Hardened inbound capture teardown by handling post-disconnect buffered events safely (`inbound_message_record_failed` warning instead of process crash when DB is already closed in one-shot commands).
- Reason: Prevent non-critical inbound persistence race from crashing ad-hoc send scripts during transport shutdown.
- Migration Impact: No schema changes.
- Rollback Notes: Revert service-layer error handling to previous strict behavior if hard-fail semantics are preferred.

- Date: 2026-02-27
- Change: Added `QuotationsPage Edgar Allan Poe` source (`https://www.quotationspage.com/quotes/Edgar_Allan_Poe/`) with `fetch_mode=browser` and validated ingestion through `agent-browser`.
- Reason: Validate production browser-worker ingestion path against a real, user-requested source.
- Migration Impact: No schema changes; seed/source registry update only.
- Rollback Notes: Remove source entry from seed and re-run bootstrap if source should be disabled.
