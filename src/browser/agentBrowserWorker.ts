import { randomUUID } from 'node:crypto';
import type { BrowserWorker } from './worker';

interface AgentBrowserLaunchOptions {
  provider?: string;
  headless: boolean;
  navigationTimeoutMs: number;
}

type BrowserManagerType = {
  launch(options: {
    id: string;
    action: 'launch';
    headless?: boolean;
    browser?: 'chromium' | 'firefox' | 'webkit';
    provider?: string;
  }): Promise<void>;
  getPage(): {
    goto(
      url: string,
      options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }
    ): Promise<unknown>;
    waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle', options?: { timeout?: number }): Promise<void>;
    content(): Promise<string>;
    locator(selector: string): { innerText(): Promise<string> };
  };
  close(): Promise<void>;
};

const loadBrowserManager = async (): Promise<new () => BrowserManagerType> => {
  const mod = (await import('agent-browser/dist/browser.js')) as unknown as {
    BrowserManager: new () => BrowserManagerType;
  };
  return mod.BrowserManager;
};

export class AgentBrowserWorker implements BrowserWorker {
  private manager: BrowserManagerType | null = null;

  public constructor(private readonly options: AgentBrowserLaunchOptions) {}

  async open(url: string): Promise<void> {
    await this.ensureManager();
    const page = this.manager!.getPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.options.navigationTimeoutMs
    });
  }

  async waitForReady(): Promise<void> {
    const page = this.requirePage();
    try {
      await page.waitForLoadState('networkidle', { timeout: this.options.navigationTimeoutMs });
    } catch {
      await page.waitForLoadState('load', { timeout: this.options.navigationTimeoutMs });
    }
  }

  async extractHTML(): Promise<string> {
    return this.requirePage().content();
  }

  async extractText(): Promise<string> {
    return this.requirePage().locator('body').innerText();
  }

  async close(): Promise<void> {
    if (!this.manager) {
      return;
    }
    await this.manager.close();
    this.manager = null;
  }

  private async ensureManager(): Promise<void> {
    if (this.manager) {
      return;
    }

    const BrowserManager = await loadBrowserManager();
    this.manager = new BrowserManager();

    const provider = this.options.provider?.trim();
    await this.manager.launch({
      id: randomUUID(),
      action: 'launch',
      browser: 'chromium',
      headless: this.options.headless,
      provider: provider && provider.length > 0 ? provider : undefined
    });
  }

  private requirePage(): ReturnType<BrowserManagerType['getPage']> {
    if (!this.manager) {
      throw new Error('agent_browser_worker_not_open');
    }
    return this.manager.getPage();
  }
}
