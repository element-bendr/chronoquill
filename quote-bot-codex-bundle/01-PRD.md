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
