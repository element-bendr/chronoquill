import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CurationService } from '../src/services/curationService';
import { QuoteCuratorService } from '../src/services/quoteCuratorService';
import { DeduplicationService } from '../src/services/deduplicationService';
import type { LLMCuratorAgent } from '../src/services/llmCuratorAgent';
import { makeTestConfig, makeTestDb, nowIso } from './helpers';

const noopLogger = { info: () => undefined } as any;

describe('LLM curation adapter', () => {
  it('applies advisory tags while deterministic validator decides final state', async () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const quoteId = randomUUID();
    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        quoteId,
        sourceId,
        'Author A',
        'A clear routine removes friction from meaningful work.',
        'a clear routine removes friction from meaningful work.',
        'llm1',
        0.5,
        'candidate',
        '[]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    const config = { ...makeTestConfig('tmp/test.db'), LLM_CURATION_ENABLED: true as const, LLM_PROVIDER_NAME: 'heuristic' as const };
    const llm: LLMCuratorAgent = {
      advise: async () => ({ themes: ['focus', 'discipline'], tone: 'directive', notes: 'stubbed_advisory' })
    };

    const service = new CurationService(repos, new QuoteCuratorService(new DeduplicationService()), noopLogger, config, llm);
    await service.runPendingCuration();

    const row = db.conn.prepare('SELECT state, theme_json, tone FROM quotes WHERE id = ?').get(quoteId) as {
      state: string;
      theme_json: string;
      tone: string;
    };

    expect(row.state).toBe('approved');
    expect(JSON.parse(row.theme_json)).toEqual(['focus', 'discipline']);
    expect(row.tone).toBe('directive');

    const event = db.conn
      .prepare("SELECT event_type FROM app_events WHERE event_type = 'llm_curation_advisory' LIMIT 1")
      .get() as { event_type: string } | undefined;
    expect(event?.event_type).toBe('llm_curation_advisory');
    db.close();
  });

  it('does not allow advisory output to bypass deterministic rejection', async () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const quoteId = randomUUID();
    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        quoteId,
        sourceId,
        'Author A',
        'Like and share now',
        'like and share now',
        'llm2',
        0.8,
        'candidate',
        '[]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    const config = { ...makeTestConfig('tmp/test.db'), LLM_CURATION_ENABLED: true as const, LLM_PROVIDER_NAME: 'heuristic' as const };
    const llm: LLMCuratorAgent = {
      advise: async () => ({ themes: ['focus'], tone: 'directive' })
    };

    const service = new CurationService(repos, new QuoteCuratorService(new DeduplicationService()), noopLogger, config, llm);
    await service.runPendingCuration();

    const row = db.conn.prepare('SELECT state FROM quotes WHERE id = ?').get(quoteId) as { state: string };
    expect(row.state).toBe('rejected');
    db.close();
  });
});
