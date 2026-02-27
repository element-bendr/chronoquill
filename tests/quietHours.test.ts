import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { RoutePlannerService } from '../src/routing/routePlannerService';
import { WhatsAppPublisherService } from '../src/publisher/whatsAppPublisherService';
import { makeTestConfig, makeTestDb, nowIso } from './helpers';

const utcDay = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

describe('WhatsAppPublisherService quiet hours', () => {
  it('skips send and records event when in quiet-hours window', async () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const quoteId = randomUUID();
    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        quoteId,
        sourceId,
        'Author A',
        'Consistency compounds over years of disciplined work.',
        'consistency compounds over years of disciplined work.',
        'qh1',
        0.95,
        'approved',
        '["focus"]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    const routeId = randomUUID();
    db.conn
      .prepare(
        `INSERT INTO routes(id,name,enabled,schedule_cron,timezone,target_type,target_ref,allowed_authors_json,allowed_themes_json,cooldown_days,quiet_hours_json,allow_same_quote_global_same_day,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        routeId,
        'quiet-route',
        1,
        '0 9 * * *',
        'UTC',
        'group',
        'main',
        '[]',
        '[]',
        45,
        JSON.stringify([{ start: '00:00', end: '23:59' }]),
        0,
        nowIso(),
        nowIso()
      );

    const planner = new RoutePlannerService(repos, makeTestConfig('tmp/test.db'));
    const sendText = vi.fn(async () => Promise.resolve());

    const publisher = new WhatsAppPublisherService(
      {
        connect: async () => Promise.resolve(),
        disconnect: async () => Promise.resolve(),
        isHealthy: async () => true,
        resolveTarget: async () => 'group:main',
        sendText
      },
      repos,
      planner,
      { info: () => undefined, warn: () => undefined, error: () => undefined } as any,
      makeTestConfig('tmp/test.db')
    );

    const route = repos.getEnabledRoutes()[0];
    await publisher.sendRoute(route, { dryRun: false, catchup: false });

    expect(sendText).toHaveBeenCalledTimes(0);

    const skipped = db.conn
      .prepare("SELECT status, error_code FROM send_events WHERE route_id = ? AND local_day = ? LIMIT 1")
      .get(routeId, utcDay()) as { status: string; error_code: string } | undefined;

    expect(skipped?.status).toBe('skipped');
    expect(skipped?.error_code).toBe('quiet_hours_deferred');

    const deferred = db.conn
      .prepare("SELECT status FROM deferred_route_runs WHERE route_id = ? AND local_day = ? LIMIT 1")
      .get(routeId, utcDay()) as { status: string } | undefined;
    expect(deferred?.status).toBe('pending');
    db.close();
  });
});
