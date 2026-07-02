import type { AidSiteFeatureCollection } from '@georesponde/shared';
import { VolatileTtlCache } from '../../transports/cache.js';

/**
 * Volatile, bounded, in-memory TTL cache for normalized Venezuela Reporta
 * `/sitios` responses. Thin alias over the shared {@link VolatileTtlCache}; the
 * 5-minute default TTL shields VR's 120 req/min budget.
 */
export class SitiosCache extends VolatileTtlCache<AidSiteFeatureCollection> {
  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    super({ ttlMs: options.ttlMs ?? 5 * 60 * 1000, maxEntries: options.maxEntries });
  }
}
