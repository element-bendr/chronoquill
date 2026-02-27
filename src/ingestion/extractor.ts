import type { QuoteCandidate } from '../types/domain';

const splitSentences = (text: string): string[] =>
  text
    .replace(/\r/g, '\n')
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export class QuoteExtractor {
  extract(raw: string, author: string, themes: string[]): QuoteCandidate[] {
    const sentences = splitSentences(raw);

    return sentences
      .filter((s) => s.length >= 30 && s.length <= 280)
      .map((s) => ({
        text: s,
        author,
        themes
      }));
  }
}
