import type { SituationFeatureCollection } from '@georesponde/shared';

interface CacheEntry {
  value: SituationFeatureCollection;
  expires: number;
}

/**
 * Volatile, bounded, in-memory TTL cache for normalized EONET responses.
 *
 * VOLATILE ONLY — never persisted to disk or DB (owner directive: GeoResponde
 * is a federator, not a store). A process restart loses nothing unique; the
 * cache merely shields EONET's 60 req/min budget (T-12-03) and is bounded with
 * oldest-key eviction to cap memory under key-cardinality flooding (T-12-02).
 */
export class EonetCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000; // 10 minutes
    this.maxEntries = options.maxEntries ?? 100;
  }

  /** Return the fresh (unexpired) value for a key, or undefined on miss/expiry. */
  get(key: string): SituationFeatureCollection | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expires) return undefined;
    return entry.value;
  }

  /**
   * Return the last cached value regardless of TTL expiry, for graceful
   * degradation when EONET is unreachable. Undefined only if never set.
   */
  getStale(key: string): SituationFeatureCollection | undefined {
    return this.store.get(key)?.value;
  }

  /** Store a value with a fresh TTL, evicting the oldest key when full. */
  set(key: string, value: SituationFeatureCollection): void {
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
