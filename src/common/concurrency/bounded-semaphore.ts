/**
 * Minimal in-memory semaphore for bounded concurrency.
 * Ensures at most `limit` async operations execute concurrently.
 */
export class BoundedSemaphore {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.active = Math.max(0, this.active);
    }
  }

  /**
   * Execute `fn` through the bounded-concurrency semaphore.
   * Guarantees at most `limit` operations are in-flight at any time.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Execute an array of async operations with bounded concurrency.
 * Preserves order of results and per-item error handling via `onError`.
 *
 * @param items - Input items to process
 * @param concurrency - Maximum number of concurrent operations
 * @param fn - Async function to apply to each item
 * @param onError - Optional error handler; if omitted, errors are re-thrown
 * @returns Array of results in the same order as input items
 */
export async function mapWithBoundedConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onError?: (error: unknown, item: T, index: number) => R,
): Promise<R[]> {
  const semaphore = new BoundedSemaphore(concurrency);
  return Promise.all(
    items.map((item, index) =>
      semaphore.run(async () => {
        try {
          return await fn(item, index);
        } catch (error) {
          if (onError) {
            return onError(error, item, index);
          }
          throw error;
        }
      }),
    ),
  );
}
