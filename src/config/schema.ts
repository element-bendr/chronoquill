import { z } from 'zod';

const envBool = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'yes') {
        return true;
      }
      if (v === 'false' || v === '0' || v === 'no') {
        return false;
      }
    }
    return value;
  }, z.boolean().default(defaultValue));

export const envSchema = z.object({
  APP_NAME: z.string().default('ChronoQuill'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TIMEZONE: z.string().min(1).default('UTC'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_PATH: z.string().min(1).default('./data/chronoquill.db'),
  TRANSPORT_ADAPTER: z.enum(['log']).default('log'),
  BROWSER_WORKER_ADAPTER: z.enum(['noop']).default('noop'),
  LLM_CURATION_ENABLED: envBool(false),
  SOURCE_SYNC_ENABLED: envBool(true),
  SOURCE_SYNC_SCHEDULE: z.string().min(1).default('0 3 * * *'),
  CATCHUP_ENABLED: envBool(true),
  GLOBAL_SAME_DAY_DUPLICATE_BLOCK: envBool(true),
  MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(5),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(1000),
  RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(30000),
  DEFAULT_COOLDOWN_DAYS: z.coerce.number().int().positive().default(45),
  ALLOW_SAME_QUOTE_GLOBAL_SAME_DAY: envBool(false)
});

export type AppConfig = z.infer<typeof envSchema>;
