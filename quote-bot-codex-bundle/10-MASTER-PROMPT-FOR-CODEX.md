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
