import { normalizeText, sha256 } from '../utils/hash';

const tokenize = (value: string): Set<string> =>
  new Set(
    normalizeText(value)
      .split(' ')
      .map((w) => w.trim())
      .filter((w) => w.length > 2)
  );

const jaccard = (a: Set<string>, b: Set<string>): number => {
  const intersection = [...a].filter((v) => b.has(v)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

export class DeduplicationService {
  exactHash(text: string): string {
    return sha256(normalizeText(text));
  }

  normalized(text: string): string {
    return normalizeText(text);
  }

  isNearDuplicate(a: string, b: string, threshold = 0.85): boolean {
    return jaccard(tokenize(a), tokenize(b)) >= threshold;
  }
}
