import type { AppLogger } from '../logging/logger';
import { sha256 } from '../utils/hash';
import { QuoteExtractor } from '../ingestion/extractor';
import { QuoteCuratorService } from './quoteCuratorService';
import { Repositories } from '../db/repositories';
import type { QuoteSourceAdapter } from '../adapters/sourceAdapter';

export class SourceSyncService {
  public constructor(
    private readonly logger: AppLogger,
    private readonly repos: Repositories,
    private readonly adapter: QuoteSourceAdapter,
    private readonly extractor: QuoteExtractor,
    private readonly curator: QuoteCuratorService
  ) {}

  async syncAllSources(): Promise<void> {
    const sources = this.repos.getEnabledSources();

    for (const source of sources) {
      const runId = this.repos.insertSourceRun({
        sourceId: source.id,
        status: 'running',
        fetchMode: source.fetch_mode === 'browser' ? 'browser' : 'direct'
      });

      try {
        const fetched = await this.adapter.fetchRaw(source);
        const rawHash = sha256(fetched.text);
        const themes = JSON.parse(source.allowed_themes_json) as string[];
        const candidates = this.extractor.extract(fetched.text, source.author, themes);

        for (const candidate of candidates) {
          const curated = this.curator.curate(candidate);
          const existing = this.repos.findQuoteByHash(curated.hash);
          if (existing) {
            if (existing.id !== undefined) {
              this.repos.upsertQuoteAlias(existing.id, candidate.text, curated.hash);
            }
            continue;
          }

          this.repos.insertQuote({
            sourceId: source.id,
            author: candidate.author,
            text: candidate.text,
            normalizedText: curated.normalizedText,
            quoteHash: curated.hash,
            confidence: curated.confidence,
            state: curated.state,
            themes: curated.themes,
            tone: curated.tone
          });
        }

        this.repos.completeSourceRun(runId, 'success', `processed_candidates=${candidates.length}`);
        this.logger.info({ source: source.name, count: candidates.length }, 'source_sync_success');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.repos.completeSourceRun(runId, 'failed', message);
        this.logger.warn({ source: source.name, error: message }, 'source_sync_failed');
      }
    }
  }
}
