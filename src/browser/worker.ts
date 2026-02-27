export interface BrowserWorker {
  open(url: string): Promise<void>;
  waitForReady(): Promise<void>;
  extractHTML(): Promise<string>;
  extractText(): Promise<string>;
  close(): Promise<void>;
}

export class NoopBrowserWorker implements BrowserWorker {
  async open(_url: string): Promise<void> {
    throw new Error('browser_worker_not_configured');
  }

  async waitForReady(): Promise<void> {
    throw new Error('browser_worker_not_configured');
  }

  async extractHTML(): Promise<string> {
    throw new Error('browser_worker_not_configured');
  }

  async extractText(): Promise<string> {
    throw new Error('browser_worker_not_configured');
  }

  async close(): Promise<void> {
    return;
  }
}
