import type { EarthquakeFeatureCollection } from '@georesponde/shared';
import { VolatileTtlCache } from '../../transports/cache.js';

/**
 * Volatile, bounded, in-memory TTL cache for normalized FUNVISIS (via SismosVE)
 * earthquake responses. Thin alias over the shared {@link VolatileTtlCache}; the
 * 5-minute default TTL matches the SismosVE refresh cadence.
 */
export class FunvisisCache extends VolatileTtlCache<EarthquakeFeatureCollection> {
  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    super({ ttlMs: options.ttlMs ?? 5 * 60 * 1000, maxEntries: options.maxEntries });
  }
}
