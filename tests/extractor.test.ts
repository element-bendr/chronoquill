import { describe, expect, it } from 'vitest';
import { QuoteExtractor } from '../src/ingestion/extractor';

describe('QuoteExtractor', () => {
  it('filters common page chrome and keeps quote lines', () => {
    const raw = [
      'Home',
      'Author Index',
      'Quotations by Author',
      'Edgar Allan Poe (1809 - 1849)',
      'Showing quotations 1 to 15 of 15 total',
      'Beauty of whatever kind, in its supreme development, invariably excites the sensitive soul to tears.',
      'Edgar Allan Poe',
      '- More quotations on: [Suffering]',
      'All that we see or seem is but a dream within a dream.',
      'Search for Edgar Allan Poe at Amazon.com',
      '(c) 1994-2025 QuotationsPage.com and Michael Moncur. All rights reserved.'
    ].join('\n');

    const extractor = new QuoteExtractor();
    const rows = extractor.extract(raw, 'Edgar Allan Poe', ['literature']);

    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.text)).toContain(
      'Beauty of whatever kind, in its supreme development, invariably excites the sensitive soul to tears.'
    );
    expect(rows.map((r) => r.text)).toContain('All that we see or seem is but a dream within a dream.');
  });
});
