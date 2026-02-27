import { makeId } from '../utils/id';
import { isoNow } from '../utils/time';
import type { Db } from './database';
import type { Quote, QuoteState, Route, SendStatus, Source } from '../types/domain';

export class Repositories {
  public constructor(private readonly db: Db) {}

  getEnabledSources(): Source[] {
    return this.db.conn.prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY priority ASC').all() as Source[];
  }

  getEnabledRoutes(): Route[] {
    return this.db.conn.prepare('SELECT * FROM routes WHERE enabled = 1 ORDER BY name ASC').all() as Route[];
  }

  insertSourceRun(row: {
    sourceId: string;
    status: 'running' | 'success' | 'failed';
    fetchMode: 'direct' | 'browser';
    rawHash?: string;
    notes?: string;
    runStartedAt?: string;
    runFinishedAt?: string;
  }): string {
    const id = makeId();
    this.db.conn
      .prepare(
        `INSERT INTO source_runs
        (id, source_id, run_started_at, run_finished_at, status, fetch_mode_used, raw_hash, notes)
        VALUES (@id, @source_id, @run_started_at, @run_finished_at, @status, @fetch_mode_used, @raw_hash, @notes)`
      )
      .run({
        id,
        source_id: row.sourceId,
        run_started_at: row.runStartedAt ?? isoNow(),
        run_finished_at: row.runFinishedAt ?? null,
        status: row.status,
        fetch_mode_used: row.fetchMode,
        raw_hash: row.rawHash ?? null,
        notes: row.notes ?? null
      });
    return id;
  }

  completeSourceRun(id: string, status: 'success' | 'failed', notes?: string): void {
    this.db.conn
      .prepare('UPDATE source_runs SET run_finished_at = ?, status = ?, notes = COALESCE(?, notes) WHERE id = ?')
      .run(isoNow(), status, notes ?? null, id);
  }

  insertQuote(row: {
    sourceId: string;
    author: string;
    text: string;
    normalizedText: string;
    quoteHash: string;
    confidence: number;
    state: QuoteState;
    themes: string[];
    tone: string;
  }): void {
    this.db.conn
      .prepare(
        `INSERT INTO quotes
        (id, source_id, author, text, normalized_text, quote_hash, confidence, state, theme_json, tone, first_seen_at, last_reviewed_at, last_sent_at)
        VALUES (@id, @source_id, @author, @text, @normalized_text, @quote_hash, @confidence, @state, @theme_json, @tone, @first_seen_at, @last_reviewed_at, @last_sent_at)`
      )
      .run({
        id: makeId(),
        source_id: row.sourceId,
        author: row.author,
        text: row.text,
        normalized_text: row.normalizedText,
        quote_hash: row.quoteHash,
        confidence: row.confidence,
        state: row.state,
        theme_json: JSON.stringify(row.themes),
        tone: row.tone,
        first_seen_at: isoNow(),
        last_reviewed_at: isoNow(),
        last_sent_at: null
      });
  }

  upsertQuoteAlias(quoteId: string, aliasText: string, aliasHash: string): void {
    this.db.conn
      .prepare(
        `INSERT INTO quote_aliases (id, quote_id, alias_text, alias_hash, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(alias_hash) DO NOTHING`
      )
      .run(makeId(), quoteId, aliasText, aliasHash, isoNow());
  }

  updateQuoteState(quoteId: string, state: QuoteState): void {
    this.db.conn.prepare('UPDATE quotes SET state = ?, last_reviewed_at = ? WHERE id = ?').run(state, isoNow(), quoteId);
  }

  updateQuoteCurationMetadata(quoteId: string, row: { confidence: number; themes: string[]; tone: string }): void {
    this.db.conn
      .prepare('UPDATE quotes SET confidence = ?, theme_json = ?, tone = ?, last_reviewed_at = ? WHERE id = ?')
      .run(row.confidence, JSON.stringify(row.themes), row.tone, isoNow(), quoteId);
  }

  findQuoteByHash(hash: string): Quote | undefined {
    return this.db.conn.prepare('SELECT * FROM quotes WHERE quote_hash = ? LIMIT 1').get(hash) as Quote | undefined;
  }

  findApprovedQuotes(): Quote[] {
    return this.db.conn.prepare("SELECT * FROM quotes WHERE state = 'approved'").all() as Quote[];
  }

  findQuoteById(id: string): Quote | undefined {
    return this.db.conn.prepare('SELECT * FROM quotes WHERE id = ? LIMIT 1').get(id) as Quote | undefined;
  }

  hasRouteSuccessForDay(routeId: string, localDay: string): boolean {
    const row = this.db.conn
      .prepare(
        "SELECT 1 AS found FROM send_events WHERE route_id = ? AND local_day = ? AND status = 'success' LIMIT 1"
      )
      .get(routeId, localDay) as { found?: number } | undefined;

    return row?.found === 1;
  }

  quoteSentGloballyToday(quoteId: string, localDay: string): boolean {
    const row = this.db.conn
      .prepare(
        "SELECT 1 AS found FROM send_events WHERE quote_id = ? AND local_day = ? AND status = 'success' LIMIT 1"
      )
      .get(quoteId, localDay) as { found?: number } | undefined;
    return row?.found === 1;
  }

  quoteSentToTargetWithinCooldown(quoteId: string, targetResolvedId: string, sinceIso: string): boolean {
    const row = this.db.conn
      .prepare(
        "SELECT 1 AS found FROM send_events WHERE quote_id = ? AND target_resolved_id = ? AND status = 'success' AND attempted_at >= ? LIMIT 1"
      )
      .get(quoteId, targetResolvedId, sinceIso) as { found?: number } | undefined;
    return row?.found === 1;
  }

  markQuoteSent(quoteId: string): void {
    this.db.conn.prepare('UPDATE quotes SET last_sent_at = ? WHERE id = ?').run(isoNow(), quoteId);
  }

  insertSendEvent(row: {
    routeId: string;
    quoteId: string | null;
    targetResolvedId: string;
    attemptedAt: string;
    localDay: string;
    status: SendStatus;
    retryCount: number;
    errorCode?: string;
    errorMessage?: string;
    wasCatchup: boolean;
  }): void {
    this.db.conn
      .prepare(
        `INSERT INTO send_events
        (id, route_id, quote_id, target_resolved_id, attempted_at, local_day, status, retry_count, error_code, error_message, was_catchup)
        VALUES (@id, @route_id, @quote_id, @target_resolved_id, @attempted_at, @local_day, @status, @retry_count, @error_code, @error_message, @was_catchup)`
      )
      .run({
        id: makeId(),
        route_id: row.routeId,
        quote_id: row.quoteId,
        target_resolved_id: row.targetResolvedId,
        attempted_at: row.attemptedAt,
        local_day: row.localDay,
        status: row.status,
        retry_count: row.retryCount,
        error_code: row.errorCode ?? null,
        error_message: row.errorMessage ?? null,
        was_catchup: row.wasCatchup ? 1 : 0
      });
  }

  appendAppEvent(eventType: string, severity: 'debug' | 'info' | 'warn' | 'error', payload: unknown): void {
    this.db.conn
      .prepare('INSERT INTO app_events (id, event_type, event_time, severity, payload_json) VALUES (?, ?, ?, ?, ?)')
      .run(makeId(), eventType, isoNow(), severity, JSON.stringify(payload));
  }

  pendingCurationQuotes(): Quote[] {
    return this.db.conn
      .prepare("SELECT * FROM quotes WHERE state IN ('candidate', 'review') ORDER BY first_seen_at ASC")
      .all() as Quote[];
  }

  listReviewQueue(limit = 100): Quote[] {
    return this.db.conn
      .prepare("SELECT * FROM quotes WHERE state = 'review' ORDER BY first_seen_at ASC LIMIT ?")
      .all(limit) as Quote[];
  }

  updateQuoteIndexed(quoteId: string, normalizedText: string, quoteHash: string): void {
    this.db.conn
      .prepare('UPDATE quotes SET normalized_text = ?, quote_hash = ?, last_reviewed_at = ? WHERE id = ?')
      .run(normalizedText, quoteHash, isoNow(), quoteId);
  }

  dbIntegrityOk(): boolean {
    const row = this.db.conn.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    return row.integrity_check === 'ok';
  }

  latestSourceRunAt(): string | null {
    const row = this.db.conn
      .prepare("SELECT run_finished_at FROM source_runs WHERE status = 'success' ORDER BY run_finished_at DESC LIMIT 1")
      .get() as { run_finished_at: string | null } | undefined;
    return row?.run_finished_at ?? null;
  }

  failedSendsSince(sinceIso: string): number {
    const row = this.db.conn
      .prepare("SELECT COUNT(*) AS c FROM send_events WHERE status = 'failed' AND attempted_at >= ?")
      .get(sinceIso) as { c: number };
    return row.c;
  }
}
