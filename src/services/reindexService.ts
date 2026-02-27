import { Repositories } from '../db/repositories';
import { normalizeText, sha256 } from '../utils/hash';

export class ReindexService {
  public constructor(private readonly repos: Repositories) {}

  run(): number {
    const quotes = this.repos.findApprovedQuotes();
    for (const quote of quotes) {
      const normalized = normalizeText(quote.text);
      const hash = sha256(normalized);
      this.repos.updateQuoteIndexed(quote.id, normalized, hash);
    }
    return quotes.length;
  }
}
