# Task List

## Current Status (2026-02-27)
- Phase 0 completed
- Phase 1 completed
- Phase 2 completed
- Phase 3 completed
- Phase 4 completed
- Phase 5 completed
- Phase 6 completed
- Phase 7 not started (optional LLM layer intentionally disabled in core path)
- Phase 8 in progress (tests and service hardening added; duplicate-window and global same-day anti-repeat tests now covered)

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
