import pino from 'pino';
import type { AppConfig } from '../config/schema';

export const buildLogger = (config: AppConfig) => {
  const pretty = config.NODE_ENV !== 'production';

  return pino({
    name: config.APP_NAME,
    level: config.LOG_LEVEL,
    transport: pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
      : undefined
  });
};

export type AppLogger = ReturnType<typeof buildLogger>;
