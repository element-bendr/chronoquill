<!-- 00-README.md -->

# Quote Bot Codex Bundle

This bundle is a full build brief for a deterministic quote collection and WhatsApp publishing system.

Primary goal:
- Collect high-quality quotes from approved sources.
- Store them in a proper database.
- Avoid repeats.
- Send one quote per day to chosen WhatsApp chats or groups.
- Recover cleanly when the PC boots after downtime.

Core product stance:
- Deterministic first.
- No LLM in the hot path.
- Optional LLM only for offline curation of long transcripts.
- Browser automation is a fallback, not the default.
- WhatsApp sending is adapter-based, so the transport can be swapped without rewriting the app.

Recommended stack:
- Node.js
- TypeScript
- SQLite
- Playwright-compatible browser worker adapter
- WhatsApp Web linked-device adapter (Baileys-style or equivalent)
- node-cron for scheduling
- systemd user service on Linux for boot auto-start

Read these files in order:
1. 10-MASTER-PROMPT-FOR-CODEX.md
2. 01-PRD.md
3. 02-ARCHITECTURE.md
4. 03-AGENTS.md
5. 04-SKILLS.md
6. 05-MEMORY.md
7. 06-SOUL.md
8. 07-HISTORY.md
9. 08-TASKLIST.md
10. 09-OPERATIONS.md

Non-goals for v1:
- No fancy dashboard.
- No multi-user SaaS panel.
- No autonomous quote posting from unverified random quote websites.
- No dependency on an LLM to complete the daily send.



<!-- 01-PRD.md -->

# Product Requirements Document

## Product Name
Quote Keeper for WhatsApp

## Product Goal
Create a local-first quote system that collects, curates, stores, schedules, and publishes one high-quality quote per day to selected WhatsApp chats and groups.

## Core Outcomes
- One quote goes out each day.
- Repeats are prevented.
- Approved sources are used.
- The system survives restarts and missed runs.
- The user can choose exact targets and quote categories.

## User Stories
- As the operator, I want to define approved sources by author, website, transcript feed, or local text so the bot only pulls from trusted material.
- As the operator, I want to route specific themes or authors to specific chats or groups.
- As the operator, I want the app to auto-start on boot and catch up if the PC was off during the scheduled window.
- As the operator, I want to inspect what was sent, when, to whom, and from which source.
- As the operator, I want the system to avoid stale repetition.
- As the operator, I want LLM assistance to be optional, not mandatory.

## v1 Scope
- Local SQLite database
- Source ingestion from approved sources
- Quote normalization and validation
- Quote cooldown logic
- Daily scheduler
- Boot catch-up logic
- WhatsApp target routing
- Structured logs
- Simple CLI

## v1.1 Scope
- Manual review queue for low-confidence quotes
- Tag-based routing weights
- Export sent history to CSV
- Basic web UI for inspection

## Out of Scope
- Public SaaS hosting
- Multi-tenant admin dashboard
- Automatic posting to multiple social platforms
- Autonomous web exploration of unknown sources

## Functional Requirements

### Source Management
- Operator can define approved sources.
- Source types:
  - static URL
  - transcript page
  - local text file
  - manual entry
- Each source must carry metadata:
  - source name
  - author
  - type
  - priority
  - allowed themes
  - fetch method
  - enabled flag

### Quote Ingestion
- Fetch raw text from sources.
- Prefer deterministic extraction from HTML.
- Browser rendering is only used when required.
- Candidate quotes are extracted from text.
- Each candidate is validated for:
  - length
  - coherence
  - attribution confidence
  - no obvious fragment-only sentence
- Each candidate is stored with a state:
  - candidate
  - approved
  - review
  - rejected

### Quote Selection
- Select from approved quotes only.
- Respect route filters by:
  - author
  - theme
  - tone
- Respect cooldown windows.
- Respect per-target repeat constraints.
- Prefer quotes with older or null last_sent_at.
- Use weighted randomness only inside valid candidates.

### Publishing
- Send to configured WhatsApp targets.
- Support both individual and group targets.
- Record each send as an event.
- Store success, failure, retry count, and error details.

### Scheduling
- Support one or more daily schedules.
- Support boot catch-up.
- Support dry-run mode.

## Non-Functional Requirements
- Reliable on a personal PC.
- Fast startup.
- Human-readable logs.
- Recoverable after crash.
- Low resource usage.
- No hidden cloud dependency for core operation.

## LLM Policy
- Not required for core operation.
- Allowed only as an optional curation assistant.
- Must be behind a feature flag.
- Must never auto-approve a quote without deterministic checks.

## Success Criteria
- 30 days of daily sends without duplicate sends caused by reboot.
- No quote repeated to the same target inside cooldown.
- All sends traceable in logs and database.
- New sources can be added without codebase surgery.



<!-- 02-ARCHITECTURE.md -->

# Architecture

## High-Level Design
The system is a deterministic pipeline with optional assistant features.

Flow:
1. Source Registry provides approved sources.
2. Ingestion fetches raw content.
3. Extraction turns content into candidate quotes.
4. Curation validates, scores, tags, and stores quotes.
5. Scheduler decides when a route should fire.
6. Boot Supervisor catches missed sends after restart.
7. Route Planner picks the best eligible quote.
8. WhatsApp Publisher sends the message.
9. Event Log records the outcome.
10. Health Monitor reports failures and drift.

## Core Modules

### Source Registry
Owns the list of approved sources and source metadata.

### Fetch Engine
Two fetch modes:
- DirectFetch: plain HTTP + parser
- BrowserFetch: browser-rendered fallback

The fetch engine must select DirectFetch first. BrowserFetch is only used if a source is marked dynamic or DirectFetch fails with a known render-required reason.

### Quote Extractor
Turns source text into quote candidates.

Recommended extraction layers:
- sentence splitting
- paragraph scoring
- quotation mark parsing where meaningful
- transcript cleanup
- author normalization

### Quote Curator
Deterministic first-pass rules:
- min length
- max length
- reject low-signal filler
- reject duplicates
- reject unresolved fragments
- attach tags
- attach confidence score

Optional LLM pass:
- summarize long passages into candidate quote lines
- classify theme
- improve tags
- propose merge candidates

LLM output must be treated as advisory. Deterministic validation decides final state.

### SQLite Store
Stores the source of truth.

### Scheduler
Uses in-process cron rules and route definitions.

### Boot Supervisor
On startup:
- read current time
- compare with route schedule
- compare with send history
- if route should have fired today and did not, trigger a catch-up send once
- mark the recovery event in logs

### Route Planner
Chooses one valid quote per route execution.

Selection order:
1. filter by route
2. remove blocked quotes by cooldown
3. remove quotes recently sent globally if global anti-repeat is on
4. sort by oldest last_sent_at, highest confidence, and source priority
5. break ties with seeded randomness

### WhatsApp Publisher
Adapter-based transport.

Interface methods:
- connect()
- isHealthy()
- resolveTarget()
- sendText(targetId, text)
- disconnect()

### Health Monitor
Checks:
- transport health
- scheduler drift
- DB integrity
- source sync freshness
- repeated send anomalies

## Why No Mandatory LLM
The daily send job is simple enough to be deterministic. An LLM would add cost, latency, and one more point of failure to a task that is mostly scheduling, filtering, and sending.

Use an LLM only where it earns its keep:
- mining long transcripts
- cleaning noisy text
- tagging themes for better routing

## Browser Agent Strategy
Treat browser automation as an interchangeable worker.

Required interface:
- open(url)
- waitForReady()
- extractHTML()
- extractText()
- close()

Implementations:
- Local Playwright worker
- Remote browser worker
- Vendor-specific browser agent adapter

This keeps the system portable and prevents lock-in.



<!-- 03-AGENTS.md -->

# Agents

This project uses service-style agents, not mystical autonomous nonsense.

## 1. BootSupervisorAgent
Purpose:
- Runs at process start.
- Performs startup health checks.
- Performs missed-run catch-up.

Responsibilities:
- confirm database is reachable
- confirm config is valid
- confirm transport is available or retrying
- inspect today's send history
- trigger catch-up once if needed

## 2. SourceSyncAgent
Purpose:
- Pull content from approved sources.

Responsibilities:
- fetch content
- detect fetch mode
- normalize raw content
- hand content to extraction pipeline

## 3. QuoteCuratorAgent
Purpose:
- Convert raw content into usable quote records.

Responsibilities:
- extract candidates
- validate candidates
- score confidence
- tag author and theme
- move records to approved, review, or rejected

## 4. DedupAgent
Purpose:
- Prevent exact and near-duplicate clutter.

Responsibilities:
- exact hash compare
- normalized text compare
- fuzzy similarity threshold compare
- merge or reject duplicates

## 5. RoutePlannerAgent
Purpose:
- Decide which quote is eligible for a route at send time.

Responsibilities:
- apply route filters
- apply cooldowns
- apply target-specific anti-repeat rules
- choose best candidate

## 6. SchedulerAgent
Purpose:
- Trigger route executions on schedule.

Responsibilities:
- register cron jobs
- guard against duplicate trigger in same window
- pass execution to publisher pipeline

## 7. WhatsAppPublisherAgent
Purpose:
- Deliver the selected quote.

Responsibilities:
- connect transport
- resolve target IDs
- send message
- log result
- retry safely on transient errors

## 8. HealthMonitorAgent
Purpose:
- Observe operational health.

Responsibilities:
- inspect send failures
- inspect stale source sync
- inspect auth disconnects
- expose basic health summary

## 9. Optional LLMCuratorAgent
Purpose:
- Assist only with offline curation.

Responsibilities:
- compress long transcript blocks into candidate quote lines
- suggest tags
- flag ambiguous attribution

Rules:
- never sends messages
- never bypasses deterministic validators
- never becomes required for daily operation



<!-- 04-SKILLS.md -->

# Skills

Skills are reusable task units each agent can call.

## Ingestion Skills
- fetch_direct_html
- fetch_browser_rendered
- extract_readable_text
- parse_transcript_blocks
- normalize_whitespace
- strip_navigation_noise

## Quote Skills
- split_sentences
- detect_quote_candidates
- normalize_author_name
- score_quote_quality
- classify_theme
- classify_tone
- compute_quote_hash
- compute_similarity

## Routing Skills
- filter_by_author
- filter_by_theme
- filter_by_tone
- enforce_global_cooldown
- enforce_target_cooldown
- pick_weighted_candidate

## Publishing Skills
- connect_transport
- resolve_target_id
- send_text_message
- retry_with_backoff
- record_send_event

## Persistence Skills
- load_config
- validate_config
- open_database
- run_migrations
- write_event_log
- mark_quote_sent
- refresh_source_state

## Health Skills
- check_transport_health
- check_db_health
- inspect_scheduler_drift
- detect_duplicate_send_window
- summarize_health_status

## Optional LLM Skills
- condense_passage_to_quote_candidates
- tag_quote_semantics
- flag_low-confidence_attribution

Rule:
Any LLM skill must be optional and must return advisory output only.



<!-- 05-MEMORY.md -->

# Memory

This file captures stable project memory that the coding agent must preserve.

## Product Memory
- This is a local-first quote publishing tool.
- The system posts one quote per day.
- The operator controls sources and targets.
- The design is deterministic-first.
- The hot path must not depend on an LLM.

## Technical Memory
- Node.js + TypeScript
- SQLite as source of truth
- Adapter-based transport and browser layers
- systemd auto-start on Linux
- Boot catch-up logic is mandatory

## Data Integrity Memory
- Approved quotes only are publishable.
- Every send must be logged.
- Cooldown must be enforced per target.
- Duplicate sends caused by reboot must be prevented.

## Design Memory
- Keep modules small and readable.
- Prefer explicit names over clever abstractions.
- Event logs matter more than decorative architecture diagrams.
- Browser rendering is fallback-only.

## LLM Memory
- LLMs are optional assistants.
- LLM output never becomes source of truth.
- Daily sends must succeed with LLM disabled.

## Migration Memory
- Schema changes must be migration-based.
- Existing send history must remain intact.
- Changes to quote uniqueness rules must be logged in HISTORY.md.



<!-- 06-SOUL.md -->

# Soul

This file defines the product's intent, temperament, and non-negotiables.

## Why This Exists
The project exists to deliver one useful thought a day with consistency, not noise.

It should feel curated, deliberate, and steady.
Not spammy.
Not chaotic.
Not dependent on cloud magic for simple chores.

## Character
- quiet
- reliable
- disciplined
- low-noise
- respectful of recipients

## Non-Negotiables
- Never become a spam cannon.
- Never auto-post unverified trash from random quote sites.
- Never sacrifice reliability for fake intelligence.
- Never hide what was sent or why.
- Never lose track of send history.

## Quality Bar
A sent quote should be:
- coherent
- attributable
- concise
- worth reading

## Design Philosophy
Boring systems win.
A daily quote bot is not a place for theatrical autonomy.
The system should use simple logic where simple logic is enough.
It should only use heavier tools when they clearly improve quality.

## Human Respect
The recipients are not a test lab.
Rate limits, quiet timing, and message quality matter.



<!-- 07-HISTORY.md -->

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



<!-- 08-TASKLIST.md -->

# Task List

## Phase 0 - Project Setup
- Initialize Node.js + TypeScript project
- Add linting, formatting, and test setup
- Add config loader and validation
- Add .env.example

## Phase 1 - Database
- Design schema
- Add migrations
- Add seed loader
- Add DB health check command

## Phase 2 - Source Ingestion
- Build source registry loader
- Build direct fetcher
- Build browser fetch adapter interface
- Build extraction pipeline

## Phase 3 - Quote Curation
- Build candidate parser
- Build validation rules
- Build dedup logic
- Build approval states

## Phase 4 - Routing and Scheduling
- Build route schema
- Build cooldown checks
- Build selector logic
- Build cron scheduler
- Build boot catch-up logic

## Phase 5 - Publishing
- Build WhatsApp transport adapter
- Build target resolution
- Build send logging
- Build retry logic

## Phase 6 - Operations
- Build structured logging
- Build health monitor
- Build dry-run mode
- Build send-now command

## Phase 7 - Optional Intelligence Layer
- Add feature-flagged LLM curation adapter
- Add review-state workflow for low-confidence outputs

## Phase 8 - Hardening
- Add tests for reboot edge cases
- Add tests for repeat prevention
- Add tests for target-specific cooldown
- Add systemd service file
- Add deployment and recovery docs

## Done Definition
The project is done for v1 when:
- daily quote sends work
- reboot catch-up works
- repeats are prevented
- state survives restarts
- logs explain what happened



<!-- 09-OPERATIONS.md -->

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

## Safe Sending Defaults
- one quote per route per day
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



<!-- 10-MASTER-PROMPT-FOR-CODEX.md -->

# Master Prompt for Codex

Build a production-grade local-first quote publishing system in Node.js and TypeScript.

The system must do the following:
- Run on a personal PC, primarily Linux.
- Start automatically on boot using a systemd user service.
- On startup, perform a boot catch-up check:
  - If today's scheduled quote has not been sent yet and the current time is after the configured send time, send it immediately.
  - Otherwise, wait for the next scheduled run.
- Publish exactly one quote per configured route per day.
- Send quotes to user-selected WhatsApp targets, including individual chats and groups.
- Persist all state in SQLite.
- Prevent repeats for a configurable cooldown window.
- Use deterministic selection and routing rules.
- Support quote ingestion from approved web sources.
- Prefer direct HTTP fetch plus text extraction.
- Use browser automation only when the source requires JavaScript rendering, cookie-backed access, or dynamic content.
- Use an adapter interface for browser automation so the implementation can be swapped between local Playwright, a remote browser worker, or a vendor-specific browser agent.
- Use an adapter interface for WhatsApp transport so the sending backend can be swapped.
- Include a health monitor and structured logging.
- Include unit tests for quote selection, deduplication, cooldown logic, and boot catch-up logic.

Hard constraints:
- Do not place an LLM in the hot path for daily sending.
- Do not require an LLM for routing, scheduling, or deduplication.
- Treat the LLM as optional and offline-only for curation tasks such as summarizing long transcripts into candidate quote lines, tagging themes, and scoring quote quality.
- The system must still run fully without any LLM enabled.
- The quote database is the source of truth.
- All mutations must be explicit, logged, and recoverable.
- Keep the design modular, readable, and boring in the best way.

Build the following:
- A clear project structure.
- A proper SQLite schema and migration strategy.
- Config loading and validation.
- Source registry for approved quote sources.
- BrowserWorker interface.
- QuoteSourceAdapter interface.
- QuoteCurator service.
- Deduplication service.
- RoutePlanner service.
- Scheduler service.
- BootSupervisor service.
- WhatsAppPublisher service.
- HealthMonitor service.
- CLI commands for:
  - bootstrap
  - sync-sources
  - curate-quotes
  - send-now
  - dry-run
  - reindex
  - db-check
- Linux systemd user service file.
- A sample .env.example.
- A seed file for initial sources and routes.
- Tests.
- A concise developer README.

Engineering style:
- Deterministic behavior over agentic theater.
- Idempotent jobs where possible.
- Append-only event logging for key actions.
- Clear TypeScript types.
- Strict error handling.
- Minimal magic.
- Minimal hidden state.
- No placeholders left unresolved.

Behavioral rules:
- Never send the same quote to the same target inside the configured cooldown window.
- Avoid sending the same quote to multiple routes on the same day unless explicitly allowed by config.
- If a source fetch fails, skip it, log it, and continue.
- If WhatsApp transport is disconnected, retry with bounded exponential backoff.
- If the app starts after downtime, recover cleanly without duplicate sends.
- If a quote fails validation, keep it in review state and never publish it automatically.

Implementation preference:
- Use better-sqlite3 or another reliable SQLite library with migrations.
- Use zod or equivalent schema validation.
- Use pino or equivalent for logging.
- Use node-cron for in-process scheduling.
- Use Playwright if implementing the local browser worker.
- Keep the browser layer abstract so a remote browser worker can be plugged in later.

Deliver complete code, not stubs.



<!-- 11-DATA-SCHEMA.md -->

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



<!-- 12-CONFIG-SHAPE.md -->

# Config Shape

## Example Logical Config

- app_name
- timezone
- log_level
- database_path
- transport_adapter
- browser_worker_adapter
- llm_curation_enabled
- llm_provider_name
- source_sync_enabled
- source_sync_schedule
- catchup_enabled
- global_same_day_duplicate_block
- max_retry_attempts
- retry_base_delay_ms
- retry_max_delay_ms
- default_cooldown_days
- allow_same_quote_global_same_day

## Route Config
Each route should define:
- route_name
- enabled
- cron
- timezone
- target_type
- target_ref
- allowed_authors
- allowed_themes
- cooldown_days
- quiet_hours
- allow_same_quote_global_same_day

## Source Config
Each source should define:
- source_name
- author
- source_type
- url_or_path
- enabled
- fetch_mode_preference
- parsing_profile
- priority
