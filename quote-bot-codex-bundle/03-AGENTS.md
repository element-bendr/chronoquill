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
