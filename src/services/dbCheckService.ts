import type { Repositories } from '../db/repositories';

export class DbCheckService {
  public constructor(private readonly repos: Repositories) {}

  run(): { ok: boolean; checks: Record<string, boolean> } {
    const checks: Record<string, boolean> = {
      integrity: this.repos.dbIntegrityOk()
    };

    return {
      ok: Object.values(checks).every(Boolean),
      checks
    };
  }
}
