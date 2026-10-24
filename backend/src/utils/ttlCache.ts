/**
 * Minimal in-process TTL cache used for read-heavy, rarely changing data.
 *
 * It also de-duplicates concurrent loads for the same key ("in-flight"
 * sharing) so parallel dashboard requests trigger a single database read.
 * This is intentionally not a distributed cache: the API runs as a single
 * process, and every cached value is safe to recompute at any time.
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T = unknown> {
  private entries = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  /**
   * @param now Injectable clock (milliseconds) so expiry can be tested
   *            without waiting for real time to pass.
   */
  constructor(private readonly now: () => number = Date.now) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Remove every entry whose key starts with `prefix`, or clear the whole
   * cache when no prefix is given.
   */
  invalidate(prefix?: string): void {
    if (!prefix) {
      this.entries.clear();
      return;
    }

    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Return a cached value or run `loader` once for all concurrent callers.
   * Failed loads are not cached and are retried by the next caller.
   */
  async getOrLoad(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}
