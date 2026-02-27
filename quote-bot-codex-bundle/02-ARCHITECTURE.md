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
