export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  /** Return false to fail immediately (e.g. on a 4xx error) */
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Run an async operation, retrying with exponential backoff on failure.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 2000,
    shouldRetry = () => true,
    onRetry,
    sleep = defaultSleep,
  } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
}

/**
 * Retry on network errors, rate limits and server errors, but not on
 * client errors such as a bad API key or invalid request.
 */
export function isTransientError(error: unknown): boolean {
  const status = (error as { code?: unknown; status?: unknown })?.status
    ?? (error as { code?: unknown })?.code;
  if (typeof status === 'number') {
    return status === 429 || status >= 500;
  }
  return true;
}
