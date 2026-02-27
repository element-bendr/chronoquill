import { describe, expect, it } from 'vitest';
import { DeduplicationService } from '../src/services/deduplicationService';

describe('DeduplicationService', () => {
  const service = new DeduplicationService();

  it('creates stable hash for normalized text', () => {
    const a = service.exactHash('Hello   world!');
    const b = service.exactHash('hello world!');
    expect(a).toBe(b);
  });

  it('detects near duplicates with high token overlap', () => {
    const a = 'Discipline is choosing what matters most every single day.';
    const b = 'Discipline means choosing what matters most, every single day.';
    expect(service.isNearDuplicate(a, b, 0.7)).toBe(true);
  });
});
