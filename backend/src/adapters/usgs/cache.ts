import type { EarthquakeFeatureCollection } from '@georesponde/shared';
import { VolatileTtlCache } from '../../transports/cache.js';

/**
 * Volatile, bounded, in-memory TTL cache for normalized USGS earthquake
 * responses. Thin alias over the shared {@link VolatileTtlCache}; the short
 * 5-minute default TTL suits volatile quake data.
 */
export class UsgsCache extends VolatileTtlCache<EarthquakeFeatureCollection> {
  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    super({ ttlMs: options.ttlMs ?? 5 * 60 * 1000, maxEntries: options.maxEntries });
  }
}
