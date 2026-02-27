export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retryWithBackoff = async <T>(
  work: (attempt: number) => Promise<T>,
  options: RetryOptions,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxAttempts) {
        break;
      }
      const delayMs = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
};
