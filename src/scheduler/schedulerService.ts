import cron, { type ScheduledTask } from 'node-cron';
import type { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import { WhatsAppPublisherService } from '../publisher/whatsAppPublisherService';
import { isoNow, localMinuteKey } from '../utils/time';
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
    const routeMap = new Map(routes.map((r) => [r.id, r]));

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

    const deferredJob = cron.schedule('* * * * *', async () => {
      const due = this.repos.listDueDeferredRouteRuns(isoNow());
      if (due.length === 0) {
        return;
      }

      for (const run of due) {
        const route = routeMap.get(run.route_id);
        if (!route || route.enabled !== 1) {
          continue;
        }

        try {
          await this.publisher.sendRoute(route, { dryRun: false, catchup: false, fromDeferred: true });
        } catch (error) {
          this.logger.error(
            { route: route.name, error: error instanceof Error ? error.message : String(error) },
            'deferred_route_failed'
          );
        }
      }
    });
    this.jobs.push(deferredJob);
    this.logger.info('scheduler_deferred_runner_registered');
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
