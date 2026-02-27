import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '../db/database';
import { normalizeText, sha256 } from '../utils/hash';
import { isoNow } from '../utils/time';

const seedSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      author: z.string(),
      source_type: z.enum(['static_url', 'transcript', 'local_text', 'manual']),
      url_or_path: z.string(),
      fetch_mode: z.enum(['direct', 'browser', 'auto']),
      priority: z.number().int(),
      allowed_themes: z.array(z.string()).default([]),
      enabled: z.boolean(),
      manual_quotes: z.array(z.string()).optional()
    })
  ),
  routes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean(),
      schedule_cron: z.string(),
      timezone: z.string(),
      target_type: z.enum(['user', 'group']),
      target_ref: z.string(),
      allowed_authors: z.array(z.string()).default([]),
      allowed_themes: z.array(z.string()).default([]),
      cooldown_days: z.number().int().positive(),
      quiet_hours: z.array(z.object({ start: z.string(), end: z.string() })).default([]),
      allow_same_quote_global_same_day: z.boolean().default(false)
    })
  )
});

export class BootstrapService {
  public constructor(private readonly db: Db) {}

  run(seedPath = './seeds/initial-seed.json'): void {
    this.db.runMigrations();

    const raw = readFileSync(resolve(process.cwd(), seedPath), 'utf8');
    const seed = seedSchema.parse(JSON.parse(raw));

    const now = isoNow();

    const insertSource = this.db.conn.prepare(
      `INSERT INTO sources
      (id, name, author, source_type, url_or_path, fetch_mode, priority, allowed_themes_json, enabled, created_at, updated_at)
      VALUES (@id, @name, @author, @source_type, @url_or_path, @fetch_mode, @priority, @allowed_themes_json, @enabled, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        author=excluded.author,
        source_type=excluded.source_type,
        url_or_path=excluded.url_or_path,
        fetch_mode=excluded.fetch_mode,
        priority=excluded.priority,
        allowed_themes_json=excluded.allowed_themes_json,
        enabled=excluded.enabled,
        updated_at=excluded.updated_at`
    );

    const insertRoute = this.db.conn.prepare(
      `INSERT INTO routes
      (id, name, enabled, schedule_cron, timezone, target_type, target_ref, allowed_authors_json, allowed_themes_json, cooldown_days, quiet_hours_json, allow_same_quote_global_same_day, created_at, updated_at)
      VALUES (@id, @name, @enabled, @schedule_cron, @timezone, @target_type, @target_ref, @allowed_authors_json, @allowed_themes_json, @cooldown_days, @quiet_hours_json, @allow_same_quote_global_same_day, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        enabled=excluded.enabled,
        schedule_cron=excluded.schedule_cron,
        timezone=excluded.timezone,
        target_type=excluded.target_type,
        target_ref=excluded.target_ref,
        allowed_authors_json=excluded.allowed_authors_json,
        allowed_themes_json=excluded.allowed_themes_json,
        cooldown_days=excluded.cooldown_days,
        quiet_hours_json=excluded.quiet_hours_json,
        allow_same_quote_global_same_day=excluded.allow_same_quote_global_same_day,
        updated_at=excluded.updated_at`
    );

    const insertQuote = this.db.conn.prepare(
      `INSERT INTO quotes
      (id, source_id, author, text, normalized_text, quote_hash, confidence, state, theme_json, tone, first_seen_at, last_reviewed_at, last_sent_at)
      VALUES (@id, @source_id, @author, @text, @normalized_text, @quote_hash, @confidence, @state, @theme_json, @tone, @first_seen_at, @last_reviewed_at, @last_sent_at)
      ON CONFLICT DO NOTHING`
    );

    const insertAppEvent = this.db.conn.prepare(
      'INSERT INTO app_events (id, event_type, event_time, severity, payload_json) VALUES (?, ?, ?, ?, ?)'
    );

    const txn = this.db.conn.transaction(() => {
      for (const source of seed.sources) {
        insertSource.run({
          ...source,
          allowed_themes_json: JSON.stringify(source.allowed_themes),
          enabled: source.enabled ? 1 : 0,
          created_at: now,
          updated_at: now
        });

        if (source.source_type === 'manual') {
          for (const quoteText of source.manual_quotes ?? []) {
            const normalized = normalizeText(quoteText);
            const hash = sha256(normalized);
            insertQuote.run({
              id: randomUUID(),
              source_id: source.id,
              author: source.author,
              text: quoteText,
              normalized_text: normalized,
              quote_hash: hash,
              confidence: 0.95,
              state: 'approved',
              theme_json: JSON.stringify(source.allowed_themes),
              tone: 'neutral',
              first_seen_at: now,
              last_reviewed_at: now,
              last_sent_at: null
            });
          }
        }
      }

      for (const route of seed.routes) {
        insertRoute.run({
          ...route,
          enabled: route.enabled ? 1 : 0,
          allowed_authors_json: JSON.stringify(route.allowed_authors),
          allowed_themes_json: JSON.stringify(route.allowed_themes),
          quiet_hours_json: JSON.stringify(route.quiet_hours),
          allow_same_quote_global_same_day: route.allow_same_quote_global_same_day ? 1 : 0,
          created_at: now,
          updated_at: now
        });
      }

      insertAppEvent.run(randomUUID(), 'bootstrap_completed', now, 'info', JSON.stringify({ seedPath }));
    });

    txn();
  }
}
