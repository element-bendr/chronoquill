import type { TargetType } from '../types/domain';

export interface WhatsAppTransport {
  connect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  resolveTarget(type: TargetType, ref: string): Promise<string>;
  sendText(targetId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
}

export class LogWhatsAppTransport implements WhatsAppTransport {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }

  async resolveTarget(type: TargetType, ref: string): Promise<string> {
    if (!this.connected) {
      throw new Error('transport_not_connected');
    }
    return `${type}:${ref}`;
  }

  async sendText(_targetId: string, _text: string): Promise<void> {
    if (!this.connected) {
      throw new Error('transport_not_connected');
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
