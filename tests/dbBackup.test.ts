import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { DbBackupService } from '../src/services/dbBackupService';
import { makeTestConfig, nowIso } from './helpers';

const countSources = (db: Db): number => {
  const row = db.conn.prepare('SELECT COUNT(*) AS c FROM sources').get() as { c: number };
  return row.c;
};

describe('DbBackupService', () => {
  it('creates a backup file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cq-backup-'));
    const dbPath = join(dir, 'main.db');
    const db = new Db(makeTestConfig(dbPath));
    db.runMigrations();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run('s1', 'source', 'Author', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const service = new DbBackupService(db);
    const backupPath = await service.backupTo(join(dir, 'backup.db'));

    expect(existsSync(backupPath)).toBe(true);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('restores from backup and creates pre-restore safety copy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cq-restore-'));
    const dbPath = join(dir, 'main.db');
    const db = new Db(makeTestConfig(dbPath));
    db.runMigrations();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run('s1', 'source-one', 'Author', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const service = new DbBackupService(db);
    const backupPath = await service.backupTo(join(dir, 'backup-before.db'));

    db.conn
      .prepare('DELETE FROM sources')
      .run();
    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run('s2', 'source-two', 'Author', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    expect(countSources(db)).toBe(1);

    const restored = service.restoreFrom(backupPath);
    expect(existsSync(restored.safetyBackupPath)).toBe(true);

    db.close();

    const dbAfter = new Db(makeTestConfig(dbPath));
    dbAfter.runMigrations();
    expect(countSources(dbAfter)).toBe(1);

    const name = dbAfter.conn.prepare('SELECT name FROM sources LIMIT 1').get() as { name: string };
    expect(name.name).toBe('source-one');
    dbAfter.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
