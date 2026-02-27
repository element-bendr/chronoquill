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
