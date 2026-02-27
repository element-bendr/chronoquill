import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AppConfig } from '../src/config/schema';
import { Db } from '../src/db/database';
import { Repositories } from '../src/db/repositories';

export const makeTestConfig = (databasePath: string): AppConfig => ({
  APP_NAME: 'ChronoQuillTest',
  NODE_ENV: 'test',
  TIMEZONE: 'UTC',
  LOG_LEVEL: 'error',
  DATABASE_PATH: databasePath,
  TRANSPORT_ADAPTER: 'log',
  BROWSER_WORKER_ADAPTER: 'noop',
  LLM_CURATION_ENABLED: false,
  SOURCE_SYNC_ENABLED: true,
  SOURCE_SYNC_SCHEDULE: '0 3 * * *',
  CATCHUP_ENABLED: true,
  GLOBAL_SAME_DAY_DUPLICATE_BLOCK: true,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1,
  RETRY_MAX_DELAY_MS: 5,
  DEFAULT_COOLDOWN_DAYS: 45,
  ALLOW_SAME_QUOTE_GLOBAL_SAME_DAY: false
});

export const makeTestDb = (): { db: Db; repos: Repositories } => {
  const dir = mkdtempSync(join(tmpdir(), 'chronoquill-test-'));
  const dbPath = join(dir, 'test.db');
  const db = new Db(makeTestConfig(dbPath));
  db.runMigrations();
  const repos = new Repositories(db);
  return { db, repos };
};

export const nowIso = (): string => new Date().toISOString();
