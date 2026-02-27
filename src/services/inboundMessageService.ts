import { isoNow } from '../utils/time';
import type { Repositories } from '../db/repositories';
import type { AppLogger } from '../logging/logger';

export interface InboundMessageInput {
  transportMessageId: string | null;
  chatId: string;
  senderId: string;
  pushName: string | null;
  text: string;
  messageType: string;
  isGroup: boolean;
  fromMe: boolean;
  receivedAt?: string;
}

export class InboundMessageService {
  public constructor(
    private readonly repos: Repositories,
    private readonly logger: AppLogger
  ) {}

  record(input: InboundMessageInput): void {
    try {
      const inserted = this.repos.insertInboundMessage({
        transportMessageId: input.transportMessageId,
        chatId: input.chatId,
        senderId: input.senderId,
        pushName: input.pushName,
        text: input.text,
        messageType: input.messageType,
        isGroup: input.isGroup,
        fromMe: input.fromMe,
        receivedAt: input.receivedAt ?? isoNow()
      });

      if (!inserted) {
        return;
      }

      this.repos.appendAppEvent('inbound_message_received', 'info', {
        chatId: input.chatId,
        senderId: input.senderId,
        messageType: input.messageType,
        isGroup: input.isGroup,
        fromMe: input.fromMe
      });

      this.logger.info(
        {
          chatId: input.chatId,
          senderId: input.senderId,
          messageType: input.messageType,
          isGroup: input.isGroup
        },
        'inbound_message_recorded'
      );
    } catch (error) {
      this.logger.warn(
        {
          chatId: input.chatId,
          senderId: input.senderId,
          error: error instanceof Error ? error.message : String(error)
        },
        'inbound_message_record_failed'
      );
    }
  }
}
