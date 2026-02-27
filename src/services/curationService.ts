import { Repositories } from '../db/repositories';
import { QuoteCuratorService } from './quoteCuratorService';
import type { AppLogger } from '../logging/logger';
import type { AppConfig } from '../config/schema';
import { NoopLLMCuratorAgent, type LLMCuratorAgent } from './llmCuratorAgent';

export class CurationService {
  public constructor(
    private readonly repos: Repositories,
    private readonly curator: QuoteCuratorService,
    private readonly logger: AppLogger,
    private readonly config: AppConfig,
    private readonly llmCurator: LLMCuratorAgent = new NoopLLMCuratorAgent()
  ) {}

  async runPendingCuration(): Promise<void> {
    const pending = this.repos.pendingCurationQuotes();

    for (const quote of pending) {
      let themes = JSON.parse(quote.theme_json) as string[];
      let tone = quote.tone;

      if (this.config.LLM_CURATION_ENABLED) {
        const advisory = await this.llmCurator.advise({
          quoteId: quote.id,
          text: quote.text,
          author: quote.author,
          themes
        });
        if (advisory.themes && advisory.themes.length > 0) {
          themes = advisory.themes;
        }
        if (advisory.tone && advisory.tone.length > 0) {
          tone = advisory.tone;
        }
        this.repos.appendAppEvent('llm_curation_advisory', 'info', {
          quoteId: quote.id,
          provider: this.config.LLM_PROVIDER_NAME,
          notes: advisory.notes ?? null
        });
      }

      const result = this.curator.curate({
        text: quote.text,
        author: quote.author,
        themes
      });

      // Deterministic result remains the final gate for state.
      this.repos.updateQuoteState(quote.id, result.state);
      this.repos.updateQuoteCurationMetadata(quote.id, {
        confidence: result.confidence,
        themes,
        tone
      });
      this.logger.info({ quoteId: quote.id, state: result.state }, 'curation_updated_quote_state');
    }
  }
}
