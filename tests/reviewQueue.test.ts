import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ReviewQueueService } from '../src/services/reviewQueueService';
import { makeTestDb, nowIso } from './helpers';

const logger = { info: () => undefined } as any;

describe('ReviewQueueService', () => {
  it('lists review-state quotes', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    db.conn
      .prepare(
        `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        randomUUID(),
        sourceId,
        'Author A',
        'This is a review quote requiring manual decision.',
        'this is a review quote requiring manual decision.',
        'rq1',
        0.55,
        'review',
        '[]',
        'neutral',
        nowIso(),
        nowIso(),
        null
      );

    const service = new ReviewQueueService(repos, logger);
    const rows = service.list();
    expect(rows.length).toBe(1);
    expect(rows[0]?.state).toBe('review');
    db.close();
  });

  it('approves/rejects review quotes and logs audit events', () => {
    const { db, repos } = makeTestDb();
    const sourceId = randomUUID();

    db.conn
      .prepare(
        `INSERT INTO sources(id,name,author,source_type,url_or_path,fetch_mode,priority,allowed_themes_json,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(sourceId, 's1', 'Author A', 'manual', 'x', 'direct', 1, '[]', 1, nowIso(), nowIso());

    const quoteApprove = randomUUID();
    const quoteReject = randomUUID();

    const insertQuote = db.conn.prepare(
      `INSERT INTO quotes(id,source_id,author,text,normalized_text,quote_hash,confidence,state,theme_json,tone,first_seen_at,last_reviewed_at,last_sent_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );

    insertQuote.run(
      quoteApprove,
      sourceId,
      'Author A',
      'Approve this one after review.',
      'approve this one after review.',
      'rq2',
      0.55,
      'review',
      '[]',
      'neutral',
      nowIso(),
      nowIso(),
      null
    );

    insertQuote.run(
      quoteReject,
      sourceId,
      'Author A',
      'Reject this one after review.',
      'reject this one after review.',
      'rq3',
      0.55,
      'review',
      '[]',
      'neutral',
      nowIso(),
      nowIso(),
      null
    );

    const service = new ReviewQueueService(repos, logger);
    service.setDecision(quoteApprove, 'approved', 'human approved');
    service.setDecision(quoteReject, 'rejected', 'human rejected');

    const approveState = db.conn.prepare('SELECT state FROM quotes WHERE id = ?').get(quoteApprove) as { state: string };
    const rejectState = db.conn.prepare('SELECT state FROM quotes WHERE id = ?').get(quoteReject) as { state: string };

    expect(approveState.state).toBe('approved');
    expect(rejectState.state).toBe('rejected');

    const events = db.conn
      .prepare("SELECT COUNT(*) AS c FROM app_events WHERE event_type = 'review_queue_decision'")
      .get() as { c: number };
    expect(events.c).toBe(2);
    db.close();
  });
});
