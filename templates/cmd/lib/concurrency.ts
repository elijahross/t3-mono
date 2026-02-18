/**
 * Client-side concurrency limiter.
 * Limits the number of concurrent async operations to avoid overwhelming the server.
 */
export function createConcurrencyLimiter(max: number) {
  let running = 0;
  const queue: (() => void)[] = [];

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };
}
