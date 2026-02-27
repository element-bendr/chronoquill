import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import type { TargetType } from '../types/domain';

export interface WhatsAppTransport {
  connect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  resolveTarget(type: TargetType, ref: string): Promise<string>;
  sendText(targetId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface BaileysTransportOptions {
  authDir: string;
  printQR: boolean;
  browserName: string;
}

export class BaileysWhatsAppTransport implements WhatsAppTransport {
  private socket: WASocket | null = null;
  private connected = false;
  private shouldReconnect = true;
  private connectingPromise: Promise<void> | null = null;

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

    await new Promise<void>((resolve, reject) => {
      const onUpdate = (update: {
        connection?: string;
        qr?: string;
        lastDisconnect?: { error?: unknown };
      }): void => {
        if (update.qr && this.options.printQR) {
          qrcode.generate(update.qr, { small: true });
        }

        if (update.connection === 'open') {
          this.connected = true;
          socket.ev.off('connection.update', onUpdate);
          resolve();
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
}
