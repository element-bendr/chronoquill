import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { envSchema, type AppConfig } from './schema';

const tryLoadDotEnv = (): void => {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const body = readFileSync(envPath, 'utf8');
  for (const line of body.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) {
      continue;
    }
    const idx = clean.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = clean.slice(0, idx).trim();
    const value = clean.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

export const loadConfig = (): AppConfig => {
  tryLoadDotEnv();
  return envSchema.parse(process.env);
};
