import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import type { Source } from '../types/domain';
import type { BrowserWorker } from '../browser/worker';

export interface QuoteSourceAdapter {
  fetchRaw(source: Source): Promise<{ text: string; fetchModeUsed: 'direct' | 'browser' }>;
}

const htmlToText = (html: string): string => {
  const $ = load(html);
  $('script,style,noscript,nav,header,footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
};

export class DefaultQuoteSourceAdapter implements QuoteSourceAdapter {
  public constructor(private readonly browserWorker: BrowserWorker) {}

  async fetchRaw(source: Source): Promise<{ text: string; fetchModeUsed: 'direct' | 'browser' }> {
    if (source.source_type === 'local_text') {
      const text = await readFile(source.url_or_path, 'utf8');
      return { text, fetchModeUsed: 'direct' };
    }

    const preferBrowser = source.fetch_mode === 'browser';
    if (!preferBrowser) {
      try {
        const response = await fetch(source.url_or_path);
        if (!response.ok) {
          throw new Error(`http_${response.status}`);
        }
        const body = await response.text();
        return { text: htmlToText(body), fetchModeUsed: 'direct' };
      } catch (error) {
        if (source.fetch_mode === 'direct') {
          throw error;
        }
      }
    }

    await this.browserWorker.open(source.url_or_path);
    await this.browserWorker.waitForReady();
    const text = await this.browserWorker.extractText();
    await this.browserWorker.close();
    return { text, fetchModeUsed: 'browser' };
  }
}
