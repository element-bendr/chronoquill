import { createHash } from 'node:crypto';

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 '\-.,!?]/g, '')
    .trim();
