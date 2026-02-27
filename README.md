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
npm run dev -- run-service
```

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
