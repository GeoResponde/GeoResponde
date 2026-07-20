import type { EarthquakeFeatureCollection } from '@georesponde/shared';

interface CacheEntry {
  data: EarthquakeFeatureCollection;
  fetchedAt: number;
}

/**
 * In-memory TTL cache for GEOFON responses.
 * FDSN queries are expensive for the upstream provider; aggressive caching
 * ensures the Situation room map can refresh frequently without abusing the GFZ API.
 * 
 * Standard TTL: 60 seconds (like EONET/USGS).
 */
export class GeofonCache {
  private store = new Map<string, CacheEntry>();
  private readonly ttlMs = 60 * 1000;

  get(key: string): EarthquakeFeatureCollection | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > this.ttlMs) return undefined;
    return entry.data;
  }

  /** Retrieve stale data, used when upstream fetch fails (graceful degradation). */
  getStale(key: string): EarthquakeFeatureCollection | undefined {
    return this.store.get(key)?.data;
  }

  set(key: string, data: EarthquakeFeatureCollection): void {
    this.store.set(key, { data, fetchedAt: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }
}
