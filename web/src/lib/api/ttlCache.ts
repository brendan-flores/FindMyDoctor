/**
 * Small client-side TTL cache for GET responses.
 *
 * It is scoped to one browser session and lives in memory only. Entries are
 * cleared whenever the session/token changes or after any successful
 * data-changing request, so a mutation is never hidden behind stale data.
 */
export interface ClientCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ClientTtlCache<T = unknown> {
  private entries = new Map<string, ClientCacheEntry<T>>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

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

  /** Invalidate keys with a prefix, or the whole cache when omitted. */
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
}
