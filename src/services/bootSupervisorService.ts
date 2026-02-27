import type { AppConfig } from '../config/schema';
import { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import { WhatsAppPublisherService } from '../publisher/whatsAppPublisherService';
import { isPastTimeToday, localDay } from '../utils/time';

export class BootSupervisorService {
  public constructor(
    private readonly repos: Repositories,
    private readonly publisher: WhatsAppPublisherService,
    private readonly logger: AppLogger,
    private readonly config: AppConfig
  ) {}

  async runCatchupCheck(): Promise<void> {
    if (!this.config.CATCHUP_ENABLED) {
      return;
    }

    const now = new Date();
    const routes = this.repos.getEnabledRoutes();

    for (const route of routes) {
      const timezone = route.timezone || this.config.TIMEZONE;
      const local = localDay(now, timezone);

      if (this.repos.hasRouteSuccessForDay(route.id, local)) {
        continue;
      }

      const parts = route.schedule_cron.trim().split(/\s+/);
      const hhmm = parts.length >= 2 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[0])
        ? `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`
        : '00:00';

      if (!isPastTimeToday(now, timezone, hhmm)) {
        continue;
      }

      this.logger.info({ route: route.name }, 'boot_catchup_triggered');
      try {
        await this.publisher.sendRoute(route, { dryRun: false, catchup: true });
        this.repos.appendAppEvent('boot_catchup_executed', 'info', { routeId: route.id, localDay: local });
      } catch (error) {
        this.repos.appendAppEvent('boot_catchup_failed', 'error', {
          routeId: route.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}
