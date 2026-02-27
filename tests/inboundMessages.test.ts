import { afterEach, describe, expect, it } from 'vitest';
import { makeTestDb, makeTestConfig } from './helpers';
import { buildLogger } from '../src/logging/logger';
import { InboundMessageService } from '../src/services/inboundMessageService';

describe('InboundMessageService', () => {
  const cleanup: Array<() => void> = [];

  afterEach(() => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      close?.();
    }
  });

  it('records inbound messages and prevents duplicate transport IDs', () => {
    const { db, repos } = makeTestDb();
    cleanup.push(() => db.close());

    const logger = buildLogger(makeTestConfig('/tmp/chronoquill-inbound-test.db'));
    const service = new InboundMessageService(repos, logger);

    service.record({
      transportMessageId: 'msg-1',
      chatId: '919892264067-1366368265@g.us',
      senderId: '919819688738@s.whatsapp.net',
      pushName: 'Test User',
      text: 'Punters reply one',
      messageType: 'conversation',
      isGroup: true,
      fromMe: false,
      receivedAt: '2026-02-27T19:00:00.000Z'
    });

    service.record({
      transportMessageId: 'msg-1',
      chatId: '919892264067-1366368265@g.us',
      senderId: '919819688738@s.whatsapp.net',
      pushName: 'Test User',
      text: 'Punters reply one duplicate',
      messageType: 'conversation',
      isGroup: true,
      fromMe: false,
      receivedAt: '2026-02-27T19:00:01.000Z'
    });

    const rows = repos.listRecentInboundMessages(10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transport_message_id).toBe('msg-1');
    expect(rows[0]?.text).toBe('Punters reply one');

    const eventCount = db.conn
      .prepare("SELECT COUNT(*) AS c FROM app_events WHERE event_type = 'inbound_message_received'")
      .get() as { c: number };
    expect(eventCount.c).toBe(1);
  });
});
