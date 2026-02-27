import type { AppConfig } from '../config/schema';
import type { Repositories } from '../db/repositories';
import type { Quote, Route } from '../types/domain';
import { localDay } from '../utils/time';

const daysAgoIso = (days: number): string => {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString();
};

const seedFrom = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const stableShuffle = <T>(items: T[], seed: number): T[] => {
  const out = [...items];
  let x = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    const j = Math.abs(x) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export class RoutePlannerService {
  public constructor(
    private readonly repos: Repositories,
    private readonly config: AppConfig
  ) {}

  pickQuote(route: Route, resolvedTargetId: string, now: Date): Quote | null {
    const local = localDay(now, route.timezone || this.config.TIMEZONE);
    const allApproved = this.repos.findApprovedQuotes();

    const allowedAuthors = JSON.parse(route.allowed_authors_json) as string[];
    const allowedThemes = JSON.parse(route.allowed_themes_json) as string[];

    let candidates = allApproved.filter((q) => {
      if (allowedAuthors.length > 0 && !allowedAuthors.includes(q.author)) {
        return false;
      }

      const quoteThemes = JSON.parse(q.theme_json) as string[];
      if (allowedThemes.length > 0 && !quoteThemes.some((t) => allowedThemes.includes(t))) {
        return false;
      }

      return true;
    });

    const cooldownSince = daysAgoIso(route.cooldown_days);
    candidates = candidates.filter(
      (q) => !this.repos.quoteSentToTargetWithinCooldown(q.id, resolvedTargetId, cooldownSince)
    );

    if (this.config.GLOBAL_SAME_DAY_DUPLICATE_BLOCK && route.allow_same_quote_global_same_day === 0) {
      candidates = candidates.filter((q) => !this.repos.quoteSentGloballyToday(q.id, local));
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const aLast = a.last_sent_at ?? '1970-01-01T00:00:00.000Z';
      const bLast = b.last_sent_at ?? '1970-01-01T00:00:00.000Z';
      if (aLast !== bLast) {
        return aLast.localeCompare(bLast);
      }
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.quote_hash.localeCompare(b.quote_hash);
    });

    const top = candidates.slice(0, Math.min(5, candidates.length));
    const shuffled = stableShuffle(top, seedFrom(`${route.id}:${local}`));
    return shuffled[0] ?? null;
  }
}
