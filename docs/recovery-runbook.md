# Recovery Runbook

## Backup
Create a manual backup before upgrades or operational changes:

```bash
npm run dev -- backup-db -- --out ./backups/pre-change.db
```

## Restore
Restore from a backup file (requires confirmation):

```bash
npm run dev -- restore-db ./backups/pre-change.db -- --yes
```

Behavior:
- A safety snapshot of the current DB is created automatically before restore.
- WAL/SHM side files are cleared before replacing the DB file.
- Restore should be run when the long-lived service is stopped.

## Recommended Recovery Sequence
1. Stop service: `systemctl --user stop chronoquill`
2. Restore database from known good backup.
3. Run integrity check: `npm run dev -- db-check`
4. Optional sanity checks:
   - `npm run dev -- review-list -- --limit 20`
   - `npm run dev -- dry-run`
5. Start service: `systemctl --user start chronoquill`
