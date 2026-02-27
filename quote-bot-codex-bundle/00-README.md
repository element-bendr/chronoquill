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
