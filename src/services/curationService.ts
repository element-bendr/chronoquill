import { Repositories } from '../db/repositories';
import { QuoteCuratorService } from './quoteCuratorService';
import type { AppLogger } from '../logging/logger';

export class CurationService {
  public constructor(
    private readonly repos: Repositories,
    private readonly curator: QuoteCuratorService,
    private readonly logger: AppLogger
  ) {}

  runPendingCuration(): void {
    const pending = this.repos.pendingCurationQuotes();

    for (const quote of pending) {
      const result = this.curator.curate({
        text: quote.text,
        author: quote.author,
        themes: JSON.parse(quote.theme_json) as string[]
      });

      this.repos.updateQuoteState(quote.id, result.state);
      this.logger.info({ quoteId: quote.id, state: result.state }, 'curation_updated_quote_state');
    }
  }
}
