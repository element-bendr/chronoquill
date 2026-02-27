import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { BootSupervisorService } from '../src/services/bootSupervisorService';
import { makeTestConfig, makeTestDb, nowIso } from './helpers';

describe('BootSupervisorService', () => {
  it('sends catch-up when route missed today', async () => {
    const { db, repos } = makeTestDb();

    db.conn
      .prepare(
        `INSERT INTO routes(id,name,enabled,schedule_cron,timezone,target_type,target_ref,allowed_authors_json,allowed_themes_json,cooldown_days,quiet_hours_json,allow_same_quote_global_same_day,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        randomUUID(),
        'r1',
        1,
        '0 0 * * *',
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

    const sendRoute = vi.fn(async () => Promise.resolve());

    const service = new BootSupervisorService(
      repos,
      { sendRoute } as any,
      { info: () => undefined } as any,
      makeTestConfig('tmp/test.db')
    );

    await service.runCatchupCheck();

    expect(sendRoute).toHaveBeenCalledTimes(1);
    db.close();
  });
});
