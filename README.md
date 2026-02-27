# ChronoQuill

ChronoQuill is a local-first deterministic quote ingestion and WhatsApp publishing service built with Node.js, TypeScript, and SQLite.

## What it does
- Ingests quote content from approved sources (direct HTTP or local files; browser fallback via adapter).
- Curates and stores quotes with deterministic validation.
- Enforces anti-repeat cooldowns and global same-day duplicate controls.
- Sends exactly one quote per route/day (DB-enforced for success events).
- Performs startup boot catch-up for missed sends.
- Exposes CLI commands for bootstrap, sync, curation, send, dry-run, reindex, and db checks.

## Setup
```bash
npm install
cp .env.example .env
npm run dev -- bootstrap
```

## CLI
```bash
npm run dev -- bootstrap
npm run dev -- sync-sources
npm run dev -- curate-quotes
npm run dev -- send-now
npm run dev -- dry-run
npm run dev -- reindex
npm run dev -- db-check
npm run dev -- review-list -- --limit 50
npm run dev -- review-approve <quoteId> -- --reason "clear attribution"
npm run dev -- review-reject <quoteId> -- --reason "fragmented quote"
npm run dev -- export-send-history -- --out ./exports/send-history.csv --limit 2000
npm run dev -- export-review-queue -- --out ./exports/review-queue.csv --limit 1000
npm run dev -- backup-db -- --out ./backups/manual-backup.db
npm run dev -- restore-db ./backups/manual-backup.db -- --yes
npm run dev -- run-service
```

## Optional Offline Advisory Curation
- Keep daily send path deterministic and LLM-free.
- To enable offline advisory curation during `curate-quotes`, set:
  - `LLM_CURATION_ENABLED=true`
  - `LLM_PROVIDER_NAME=heuristic`

## WhatsApp Connection (Production Transport)
- Transport uses Baileys with persistent auth files in `BAILEYS_AUTH_DIR`.
- First connection requires QR scan:
  1. run `npm run dev -- send-now` or `npm run dev -- run-service`
  2. scan QR from terminal with WhatsApp Linked Devices
  3. session is persisted; future runs reconnect without rescanning unless logged out
- Route targets:
  - `target_type=user`: set `target_ref` to phone digits with country code (or full `@s.whatsapp.net` JID)
  - `target_type=group`: set `target_ref` to group JID (`...@g.us`) or exact group subject name

## Systemd user service
Copy `systemd/chronoquill.service` to:
- `~/.config/systemd/user/chronoquill.service`

Then:
```bash
systemctl --user daemon-reload
systemctl --user enable --now chronoquill.service
```

## Tests
```bash
npm test
```
# chronoquill
