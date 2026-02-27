import type { AppConfig } from '../config/schema';
import { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import { retryWithBackoff } from '../utils/retry';
import { isoNow, localDay } from '../utils/time';
import type { Route } from '../types/domain';
import type { WhatsAppTransport } from '../adapters/whatsapp';
import { RoutePlannerService } from '../routing/routePlannerService';

export class WhatsAppPublisherService {
  public constructor(
    private readonly transport: WhatsAppTransport,
    private readonly repos: Repositories,
    private readonly planner: RoutePlannerService,
    private readonly logger: AppLogger,
    private readonly config: AppConfig
  ) {}

  async sendRoute(route: Route, options: { dryRun: boolean; catchup: boolean }): Promise<void> {
    const now = new Date();
    const local = localDay(now, route.timezone || this.config.TIMEZONE);

    if (this.repos.hasRouteSuccessForDay(route.id, local)) {
      this.logger.info({ route: route.name, localDay: local }, 'route_already_sent_today');
      return;
    }

    const targetId = await this.transport.resolveTarget(route.target_type, route.target_ref);
    const quote = this.planner.pickQuote(route, targetId, now);

    if (!quote) {
      this.repos.insertSendEvent({
        routeId: route.id,
        quoteId: null,
        targetResolvedId: targetId,
        attemptedAt: isoNow(),
        localDay: local,
        status: 'skipped',
        retryCount: 0,
        errorCode: 'no_eligible_quote',
        errorMessage: 'No approved quote passed route and cooldown filters',
        wasCatchup: options.catchup
      });
      this.logger.warn({ route: route.name }, 'no_eligible_quote');
      return;
    }

    const message = `\"${quote.text}\"\n\n- ${quote.author}`;

    if (options.dryRun) {
      this.logger.info({ route: route.name, quoteId: quote.id, target: targetId }, 'dry_run_send');
      return;
    }

    let retries = 0;
    try {
      await retryWithBackoff(
        async (attempt) => {
          retries = attempt - 1;
          await this.transport.sendText(targetId, message);
        },
        {
          maxAttempts: this.config.MAX_RETRY_ATTEMPTS,
          baseDelayMs: this.config.RETRY_BASE_DELAY_MS,
          maxDelayMs: this.config.RETRY_MAX_DELAY_MS
        },
        (attempt, error, delayMs) => {
          this.logger.warn(
            { route: route.name, attempt, delayMs, error: error instanceof Error ? error.message : String(error) },
            'send_retry'
          );
        }
      );

      this.repos.insertSendEvent({
        routeId: route.id,
        quoteId: quote.id,
        targetResolvedId: targetId,
        attemptedAt: isoNow(),
        localDay: local,
        status: 'success',
        retryCount: retries,
        wasCatchup: options.catchup
      });
      this.repos.markQuoteSent(quote.id);
      this.logger.info({ route: route.name, quoteId: quote.id }, 'send_success');
    } catch (error) {
      const messageErr = error instanceof Error ? error.message : String(error);
      this.repos.insertSendEvent({
        routeId: route.id,
        quoteId: quote.id,
        targetResolvedId: targetId,
        attemptedAt: isoNow(),
        localDay: local,
        status: 'failed',
        retryCount: retries,
        errorCode: 'send_failed',
        errorMessage: messageErr,
        wasCatchup: options.catchup
      });
      this.logger.error({ route: route.name, error: messageErr }, 'send_failed');
      throw error;
    }
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }
}
