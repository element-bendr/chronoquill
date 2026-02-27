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

const todayUtc = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );

const insertApprovedQuote = (db: any, sourceId: string, quoteId: string, hash = 'h1'): void => {
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
      hash,
      0.9,
      'approved',
      '["focus"]',
      'neutral',
      nowIso(),
      nowIso(),
      null
    );
};

const insertRoute = (db: any, routeId: string, name: string, allowSameQuoteGlobalSameDay = 0): void => {
  db.conn
    .prepare(
      `INSERT INTO routes(id,name,enabled,schedule_cron,timezone,target_type,target_ref,allowed_authors_json,allowed_themes_json,cooldown_days,quiet_hours_json,allow_same_quote_global_same_day,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      routeId,
      name,
      1,
      '0 9 * * *',
      'UTC',
      'group',
      `${name}-target`,
      '[]',
      '[]',
      45,
      '[]',
      allowSameQuoteGlobalSameDay,
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
    insertApprovedQuote(db, sourceId, quoteId);

    const routeId = randomUUID();
    insertRoute(db, routeId, 'r1');

    repos.insertSendEvent({
      routeId,
      quoteId,
      targetResolvedId: 'group:main',
      attemptedAt: nowIso(),
      localDay: todayUtc(),
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

  it('blocks same quote across routes on same day when global block is enabled', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();
    insertSource(db, sourceId);
    const quoteId = randomUUID();
    insertApprovedQuote(db, sourceId, quoteId, 'h-global');

    const route1 = randomUUID();
    const route2 = randomUUID();
    insertRoute(db, route1, 'route-one');
    insertRoute(db, route2, 'route-two');

    repos.insertSendEvent({
      routeId: route1,
      quoteId,
      targetResolvedId: 'group:route-one-target',
      attemptedAt: nowIso(),
      localDay: todayUtc(),
      status: 'success',
      retryCount: 0,
      wasCatchup: false
    });

    const planner = new RoutePlannerService(repos, makeTestConfig('tmp/test.db'));
    const route = repos.getEnabledRoutes().find((r) => r.id === route2);
    const picked = planner.pickQuote(route!, 'group:route-two-target', new Date());

    expect(picked).toBeNull();
    db.close();
  });

  it('allows same quote across routes on same day when route override is enabled', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();
    insertSource(db, sourceId);
    const quoteId = randomUUID();
    insertApprovedQuote(db, sourceId, quoteId, 'h-override');

    const route1 = randomUUID();
    const route2 = randomUUID();
    insertRoute(db, route1, 'route-one');
    insertRoute(db, route2, 'route-two', 1);

    repos.insertSendEvent({
      routeId: route1,
      quoteId,
      targetResolvedId: 'group:route-one-target',
      attemptedAt: nowIso(),
      localDay: todayUtc(),
      status: 'success',
      retryCount: 0,
      wasCatchup: false
    });

    const planner = new RoutePlannerService(repos, makeTestConfig('tmp/test.db'));
    const route = repos.getEnabledRoutes().find((r) => r.id === route2);
    const picked = planner.pickQuote(route!, 'group:route-two-target', new Date());

    expect(picked?.id).toBe(quoteId);
    db.close();
  });
});
