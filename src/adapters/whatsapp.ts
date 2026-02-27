import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState, proto,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import type { TargetType } from '../types/domain';

export interface WhatsAppTransport {
  connect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  resolveTarget(type: TargetType, ref: string): Promise<string>;
  sendText(targetId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
  setIncomingMessageHandler?(handler: IncomingMessageHandler): void;
}

export interface IncomingMessagePayload {
  transportMessageId: string | null;
  chatId: string;
  senderId: string;
  pushName: string | null;
  text: string;
  messageType: string;
  isGroup: boolean;
  fromMe: boolean;
  receivedAt: string;
}

export type IncomingMessageHandler = (message: IncomingMessagePayload) => void | Promise<void>;

interface ExtractedText {
  text: string;
  messageType: string;
}

export interface BaileysTransportOptions {
  authDir: string;
  printQR: boolean;
  qrImagePath: string;
  browserName: string;
}

export class BaileysWhatsAppTransport implements WhatsAppTransport {
  private socket: WASocket | null = null;
  private connected = false;
  private shouldReconnect = true;
  private connectingPromise: Promise<void> | null = null;
  private incomingMessageHandler: IncomingMessageHandler | null = null;

  public constructor(private readonly options: BaileysTransportOptions) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.shouldReconnect = true;
    this.connectingPromise = this.initializeConnection();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }

  async resolveTarget(type: TargetType, ref: string): Promise<string> {
    const socket = this.requireSocket();

    if (type === 'user') {
      if (ref.endsWith('@s.whatsapp.net')) {
        return jidNormalizedUser(ref);
      }
      const digits = ref.replace(/[^0-9]/g, '');
      if (!digits) {
        throw new Error(`invalid_user_target_ref:${ref}`);
      }
      return jidNormalizedUser(`${digits}@s.whatsapp.net`);
    }

    if (ref.endsWith('@g.us')) {
      return ref;
    }

    const groups = await socket.groupFetchAllParticipating();
    const byId = groups[ref];
    if (byId) {
      return byId.id;
    }

    const lowered = ref.trim().toLowerCase();
    for (const group of Object.values(groups)) {
      if (group.subject?.trim().toLowerCase() === lowered) {
        return group.id;
      }
    }

    throw new Error(`group_target_not_found:${ref}`);
  }

  async sendText(targetId: string, text: string): Promise<void> {
    const socket = this.requireSocket();
    await socket.sendMessage(targetId, { text });
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.connected = false;

    const socket = this.socket;
    this.socket = null;

    if (socket?.ws) {
      try {
        socket.ws.close();
      } catch {
        // no-op
      }
    }
  }

  setIncomingMessageHandler(handler: IncomingMessageHandler): void {
    this.incomingMessageHandler = handler;
  }

  private async initializeConnection(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.options.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: [this.options.browserName, 'Chrome', '1.0.0']
    });

    this.socket = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.upsert', (update) => {
      void this.handleMessagesUpsert(update.messages ?? []);
    });

    await new Promise<void>((promiseResolve, reject) => {
      const onUpdate = (update: {
        connection?: string;
        qr?: string;
        lastDisconnect?: { error?: unknown };
      }): void => {
        if (update.qr && this.options.printQR) {
          qrcode.generate(update.qr, { small: true });
        }
        if (update.qr) {
          const out = pathResolve(process.cwd(), this.options.qrImagePath);
          mkdirSync(dirname(out), { recursive: true });
          void QRCode.toFile(out, update.qr, { margin: 1, width: 512 }).then(() => {
            console.log(`WHATSAPP_QR_IMAGE ${out}`);
          });
        }

        if (update.connection === 'open') {
          this.connected = true;
          socket.ev.off('connection.update', onUpdate);
          promiseResolve();
          return;
        }

        if (update.connection === 'close') {
          this.connected = false;

          const disconnectError = update.lastDisconnect?.error;
          const statusCode =
            disconnectError instanceof Boom
              ? disconnectError.output.statusCode
              : new Boom(disconnectError instanceof Error ? disconnectError : undefined).output.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          socket.ev.off('connection.update', onUpdate);

          if (loggedOut) {
            reject(new Error('whatsapp_logged_out_relink_required'));
            return;
          }

          if (this.shouldReconnect) {
            setTimeout(() => {
              void this.connect();
            }, 2000);
          }

          reject(new Error(`whatsapp_connection_closed:${statusCode}`));
        }
      };

      socket.ev.on('connection.update', onUpdate);
    });
  }

  private requireSocket(): WASocket {
    if (!this.socket || !this.connected) {
      throw new Error('whatsapp_transport_not_connected');
    }
    return this.socket;
  }

  private async handleMessagesUpsert(messages: proto.IWebMessageInfo[]): Promise<void> {
    if (!this.incomingMessageHandler) {
      return;
    }

    for (const entry of messages) {
      const key = entry.key;
      const chatId = key?.remoteJid ?? '';
      if (!chatId || chatId === 'status@broadcast') {
        continue;
      }

      const extracted = this.extractText(entry.message ?? undefined);
      if (!extracted) {
        continue;
      }

      const senderId = key?.participant || key?.remoteJid || '';
      if (!senderId) {
        continue;
      }

      const timestampSeconds = Number(entry.messageTimestamp ?? 0);
      const receivedAt =
        Number.isFinite(timestampSeconds) && timestampSeconds > 0
          ? new Date(timestampSeconds * 1000).toISOString()
          : new Date().toISOString();

      await this.incomingMessageHandler({
        transportMessageId: key?.id ?? null,
        chatId,
        senderId,
        pushName: entry.pushName ?? null,
        text: extracted.text,
        messageType: extracted.messageType,
        isGroup: chatId.endsWith('@g.us'),
        fromMe: key?.fromMe === true,
        receivedAt
      });
    }
  }

  private extractText(message: proto.IMessage | undefined): ExtractedText | null {
    if (!message) {
      return null;
    }

    if (message.conversation) {
      return { text: message.conversation, messageType: 'conversation' };
    }
    if (message.extendedTextMessage?.text) {
      return { text: message.extendedTextMessage.text, messageType: 'extendedTextMessage' };
    }
    if (message.imageMessage?.caption) {
      return { text: message.imageMessage.caption, messageType: 'imageMessage' };
    }
    if (message.videoMessage?.caption) {
      return { text: message.videoMessage.caption, messageType: 'videoMessage' };
    }
    if (message.documentMessage?.caption) {
      return { text: message.documentMessage.caption, messageType: 'documentMessage' };
    }
    if (message.ephemeralMessage?.message) {
      const nested = this.extractText(message.ephemeralMessage.message);
      if (nested) {
        return nested;
      }
    }
    if (message.viewOnceMessage?.message) {
      const nested = this.extractText(message.viewOnceMessage.message);
      if (nested) {
        return nested;
      }
    }
    if (message.viewOnceMessageV2?.message) {
      const nested = this.extractText(message.viewOnceMessageV2.message);
      if (nested) {
        return nested;
      }
    }

    return null;
  }
}
