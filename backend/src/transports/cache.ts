/**
 * Generic volatile, bounded, in-memory TTL cache. The single implementation
 * behind the EONET / USGS / FUNVISIS / sitios caches (previously four identical
 * copies).
 *
 * VOLATILE ONLY — never persisted to disk or DB (owner directive: GeoResponde is
 * a federator, not a store). A process restart loses nothing unique; the cache
 * merely shields an upstream's rate budget and is bounded with oldest-key
 * eviction to cap memory under key-cardinality flooding.
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class VolatileTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxEntries = options.maxEntries ?? 100;
  }

  /** Return the fresh (unexpired) value for a key, or undefined on miss/expiry. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expires) return undefined;
    return entry.value;
  }

  /**
   * Return the last cached value regardless of TTL expiry, for graceful
   * degradation when the upstream is unreachable. Undefined only if never set.
   */
  getStale(key: string): T | undefined {
    return this.store.get(key)?.value;
  }

  /** Store a value with a fresh TTL, evicting the oldest key when full. */
  set(key: string, value: T): void {
    // Refresh insertion order so recently-set keys are considered newest.
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });

    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
