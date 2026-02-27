import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Repositories, SendEventExportRow } from '../db/repositories';

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes(',') || text.includes('\n') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const out: string[] = [];
  out.push(headers.join(','));
  for (const row of rows) {
    out.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  out.push('');
  return out.join('\n');
};

export class CsvExportService {
  public constructor(private readonly repos: Repositories) {}

  exportSendHistory(filePath: string, limit = 1000): { path: string; count: number } {
    const rows = this.repos.exportSendEventsCsvRows(limit);
    const headers = [
      'id',
      'route_id',
      'route_name',
      'quote_id',
      'quote_author',
      'quote_text',
      'target_resolved_id',
      'attempted_at',
      'local_day',
      'status',
      'retry_count',
      'error_code',
      'error_message',
      'was_catchup'
    ] as const;
    const data = toCsv(headers as unknown as string[], rows as unknown as Array<Record<string, unknown>>);
    const abs = resolve(process.cwd(), filePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, data, 'utf8');
    return { path: abs, count: rows.length };
  }

  exportReviewQueue(filePath: string, limit = 1000): { path: string; count: number } {
    const rows = this.repos.listReviewQueue(limit).map((q) => ({
      id: q.id,
      source_id: q.source_id,
      author: q.author,
      text: q.text,
      confidence: q.confidence,
      state: q.state,
      themes: q.theme_json,
      tone: q.tone,
      first_seen_at: q.first_seen_at,
      last_reviewed_at: q.last_reviewed_at
    }));
    const headers = [
      'id',
      'source_id',
      'author',
      'text',
      'confidence',
      'state',
      'themes',
      'tone',
      'first_seen_at',
      'last_reviewed_at'
    ];
    const data = toCsv(headers, rows);
    const abs = resolve(process.cwd(), filePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, data, 'utf8');
    return { path: abs, count: rows.length };
  }
}
