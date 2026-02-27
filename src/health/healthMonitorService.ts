import type { AppConfig } from '../config/schema';
import type { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import type { WhatsAppTransport } from '../adapters/whatsapp';

const hoursAgoIso = (hours: number): string => {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() - hours);
  return date.toISOString();
};

export class HealthMonitorService {
  public constructor(
    private readonly repos: Repositories,
    private readonly transport: WhatsAppTransport,
    private readonly logger: AppLogger,
    private readonly config: AppConfig
  ) {}

  async check(): Promise<{ ok: boolean; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};

    checks.dbIntegrity = this.repos.dbIntegrityOk();
    checks.transportHealthy = await this.transport.isHealthy();

    const latestSource = this.repos.latestSourceRunAt();
    checks.sourceFresh =
      latestSource !== null
        ? new Date(latestSource).getTime() > new Date(hoursAgoIso(48)).getTime()
        : false;

    checks.recentFailuresLow = this.repos.failedSendsSince(hoursAgoIso(24)) <= this.config.MAX_RETRY_ATTEMPTS;

    const ok = Object.values(checks).every(Boolean);
    this.logger.info({ checks, ok }, 'health_check');
    return { ok, checks };
  }
}
