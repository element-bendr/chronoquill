import type { QuoteCandidate, QuoteState } from '../types/domain';
import { DeduplicationService } from './deduplicationService';

export interface CuratedQuote {
  text: string;
  normalizedText: string;
  hash: string;
  confidence: number;
  state: QuoteState;
  themes: string[];
  tone: string;
}

const fillerRe = /(subscribe|follow me|like and share|smash that|buy now)/i;

export class QuoteCuratorService {
  public constructor(private readonly dedup: DeduplicationService) {}

  curate(candidate: QuoteCandidate): CuratedQuote {
    const normalized = this.dedup.normalized(candidate.text);
    const hash = this.dedup.exactHash(candidate.text);

    let state: QuoteState = 'approved';
    let confidence = 0.9;

    if (candidate.text.length < 45 || candidate.text.length > 260) {
      state = 'review';
      confidence = 0.55;
    }

    if (!/[a-zA-Z]/.test(candidate.text) || fillerRe.test(candidate.text)) {
      state = 'rejected';
      confidence = 0.2;
    }

    if (!/[.!?]$/.test(candidate.text)) {
      state = state === 'approved' ? 'review' : state;
      confidence = Math.min(confidence, 0.6);
    }

    return {
      text: candidate.text,
      normalizedText: normalized,
      hash,
      confidence,
      state,
      themes: candidate.themes,
      tone: 'neutral'
    };
  }
}
