import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import type { Db } from '../db/database';
import { isoNow } from '../utils/time';

const stamp = (): string => isoNow().replace(/[:.]/g, '-');

export class DbBackupService {
  public constructor(private readonly db: Db) {}

  async backupTo(outputPath?: string): Promise<string> {
    const out =
      outputPath && outputPath.trim().length > 0
        ? resolve(process.cwd(), outputPath)
        : resolve(process.cwd(), `./backups/chronoquill-${stamp()}.db`);

    mkdirSync(dirname(out), { recursive: true });
    await this.db.conn.backup(out);
    return out;
  }

  restoreFrom(inputPath: string): { restoredTo: string; safetyBackupPath: string } {
    const source = resolve(process.cwd(), inputPath);
    if (!existsSync(source)) {
      throw new Error(`backup_not_found:${source}`);
    }

    const dbPath = this.db.dbPath;
    const safetyBackupPath = resolve(
      dirname(dbPath),
      `${basename(dbPath, extname(dbPath))}.pre-restore-${stamp()}${extname(dbPath)}`
    );

    if (existsSync(dbPath)) {
      copyFileSync(dbPath, safetyBackupPath);
    } else {
      mkdirSync(dirname(dbPath), { recursive: true });
      copyFileSync(source, safetyBackupPath);
    }

    // Restore replaces the DB file and must not run with an open SQLite handle.
    this.db.close();

    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (existsSync(walPath)) {
      unlinkSync(walPath);
    }
    if (existsSync(shmPath)) {
      unlinkSync(shmPath);
    }

    copyFileSync(source, dbPath);
    return { restoredTo: dbPath, safetyBackupPath };
  }
}
