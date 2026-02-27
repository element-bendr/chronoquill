import cron, { type ScheduledTask } from 'node-cron';
import type { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import { WhatsAppPublisherService } from '../publisher/whatsAppPublisherService';
import { localMinuteKey } from '../utils/time';
import { RouteExecutionWindowGuard } from './routeExecutionWindowGuard';

export class SchedulerService {
  private readonly jobs: ScheduledTask[] = [];
  private readonly windowGuard = new RouteExecutionWindowGuard();

  public constructor(
    private readonly repos: Repositories,
    private readonly publisher: WhatsAppPublisherService,
    private readonly logger: AppLogger
  ) {}

  register(): void {
    const routes = this.repos.getEnabledRoutes();

    for (const route of routes) {
      const job = cron.schedule(
        route.schedule_cron,
        async () => {
          const currentKey = localMinuteKey(new Date(), route.timezone);
          if (!this.windowGuard.shouldRun(route.id, currentKey)) {
            this.logger.warn({ route: route.name, minuteKey: currentKey }, 'scheduler_duplicate_window_blocked');
            return;
          }

          try {
            await this.publisher.sendRoute(route, { dryRun: false, catchup: false });
          } catch (error) {
            this.logger.error(
              { route: route.name, error: error instanceof Error ? error.message : String(error) },
              'scheduled_route_failed'
            );
          }
        },
        { timezone: route.timezone }
      );

      this.jobs.push(job);
      this.logger.info({ route: route.name, cron: route.schedule_cron }, 'scheduler_route_registered');
    }
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
      job.destroy();
    }
    this.jobs.length = 0;
    this.windowGuard.clear();
  }
}
