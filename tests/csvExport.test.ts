import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { CsvExportService } from '../src/services/csvExportService';
import { makeTestDb, nowIso } from './helpers';

describe('CsvExportService', () => {
  it('exports send history csv with expected headers and row content', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();
    const routeId = randomUUID();
    const quoteId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    db.conn
      .prepare(
        `INSERT INTO routes(id,name,enabled,schedule_cron,timezone,target_type,target_ref,allowed_authors_json,allowed_themes_json,cooldown_days,quiet_hours_json,allow_same_quote_global_same_day,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(routeId, 'Route One', 1, '0 9 * * *', 'UTC', 'group', 'main', '[]', '[]', 45, '[]', 0, nowIso(), nowIso());

    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        quoteId,
        sourceId,
        'Author A',
        'A quote with, comma',
        'a quote with comma',
        'csv-h1',
        0.9,
        'approved',
        '[]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    repos.insertSendEvent({
      routeId,
      quoteId,
      targetResolvedId: 'group:main',
      attemptedAt: nowIso(),
      localDay: '2026-02-27',
      status: 'success',
      retryCount: 0,
      wasCatchup: false
    });

    const dir = mkdtempSync(join(tmpdir(), 'cq-csv-'));
    const out = join(dir, 'send.csv');
    const service = new CsvExportService(repos);
    const result = service.exportSendHistory(out, 100);

    expect(result.count).toBe(1);
    const csv = readFileSync(out, 'utf8');
    expect(csv).toContain('route_name');
    expect(csv).toContain('Route One');
    expect(csv).toContain('"A quote with, comma"');
    db.close();
  });

  it('exports review queue csv rows', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        randomUUID(),
        sourceId,
        'Author A',
        'Needs manual review quote.',
        'needs manual review quote.',
        'csv-h2',
        0.5,
        'review',
        '[]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    const dir = mkdtempSync(join(tmpdir(), 'cq-csv-'));
    const out = join(dir, 'review.csv');
    const service = new CsvExportService(repos);
    const result = service.exportReviewQueue(out, 100);

    expect(result.count).toBe(1);
    const csv = readFileSync(out, 'utf8');
    expect(csv).toContain('state');
    expect(csv).toContain('review');
    db.close();
  });
});
