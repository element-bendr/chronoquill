import type { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';
import type { Quote, QuoteState } from '../types/domain';

export class ReviewQueueService {
  public constructor(
    private readonly repos: Repositories,
    private readonly logger: AppLogger
  ) {}

  list(limit = 100): Quote[] {
    return this.repos.listReviewQueue(limit);
  }

  setDecision(quoteId: string, decision: Extract<QuoteState, 'approved' | 'rejected'>, reason?: string): void {
    const quote = this.repos.findQuoteById(quoteId);
    if (!quote) {
      throw new Error(`quote_not_found:${quoteId}`);
    }

    if (quote.state !== 'review') {
      throw new Error(`quote_not_in_review:${quoteId}`);
    }

    this.repos.updateQuoteState(quoteId, decision);
    this.repos.appendAppEvent('review_queue_decision', 'info', {
      quoteId,
      fromState: 'review',
      toState: decision,
      reason: reason ?? null
    });
    this.logger.info({ quoteId, decision, reason: reason ?? null }, 'review_queue_decision_applied');
  }
}
