import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RoutePlannerService } from '../src/routing/routePlannerService';
import { makeTestConfig, makeTestDb, nowIso } from './helpers';

const insertSource = (dbPath: any, sourceId: string): void => {
  dbPath.conn
    .prepare(
      `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      sourceId,
      's1',
      'Author A',
      'manual',
      'x',
      'direct',
      1,
      '[]',
      1,
      nowIso(),
      nowIso()
    );
};

describe('RoutePlannerService', () => {
  it('blocks quote in target cooldown window', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();
    insertSource(db, sourceId);

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
        'Consistency builds trust and trust builds momentum.',
        'consistency builds trust and trust builds momentum.',
        'h1',
        0.9,
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
        'r1',
        1,
        '0 9 * * *',
        'UTC',
        'group',
        'main',
        '[]',
        '[]',
        45,
        '[]',
        0,
        nowIso(),
        nowIso()
      );

    repos.insertSendEvent({
      routeId,
      quoteId,
      targetResolvedId: 'group:main',
      attemptedAt: nowIso(),
      localDay: new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
        new Date()
      ),
      status: 'success',
      retryCount: 0,
      wasCatchup: false
    });

    const planner = new RoutePlannerService(repos, makeTestConfig('tmp/test.db'));
    const route = repos.getEnabledRoutes()[0];
    const picked = planner.pickQuote(route, 'group:main', new Date());

    expect(picked).toBeNull();
    db.close();
  });
});
