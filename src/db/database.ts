import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import type { AppConfig } from '../config/schema';

export class Db {
  public readonly conn: Database.Database;

  public constructor(config: AppConfig) {
    const dbPath = resolve(process.cwd(), config.DATABASE_PATH);
    mkdirSync(dirname(dbPath), { recursive: true });
    this.conn = new Database(dbPath);
    this.conn.pragma('foreign_keys = ON');
    this.conn.pragma('journal_mode = WAL');
  }

  runMigrations(): void {
    const migrationsDir = resolve(process.cwd(), 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((name) => extname(name) === '.sql')
      .sort();

    this.conn.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`
    );

    const appliedRows = this.conn.prepare('SELECT version FROM schema_migrations').all() as {
      version: string;
    }[];
    const applied = new Set(appliedRows.map((row) => row.version));

    const insertVersion = this.conn.prepare(
      'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
    );

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      const txn = this.conn.transaction(() => {
        this.conn.exec(sql);
        insertVersion.run(file, new Date().toISOString());
      });
      txn();
    }
  }

  close(): void {
    this.conn.close();
  }
}
