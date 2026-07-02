import type { SituationFeatureCollection } from '@georesponde/shared';
import { VolatileTtlCache } from '../../transports/cache.js';

/**
 * Volatile, bounded, in-memory TTL cache for normalized EONET responses. Thin
 * alias over the shared {@link VolatileTtlCache}; the 10-minute default TTL
 * shields EONET's 60 req/min budget (T-12-03).
 */
export class EonetCache extends VolatileTtlCache<SituationFeatureCollection> {
  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    super({ ttlMs: options.ttlMs ?? 10 * 60 * 1000, maxEntries: options.maxEntries });
  }
}
