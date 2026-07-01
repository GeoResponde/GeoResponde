import { VolatileTtlCache } from '../../transports/cache.js';
import type { DamageFeatureCollection } from './parser.js';

/**
 * Volatile, bounded, in-memory TTL cache for merged Copernicus damage
 * collections. Thin alias over the shared {@link VolatileTtlCache}; the 6-hour
 * default TTL reflects that an activation's geometry is static-ish per version
 * (D-06). VOLATILE ONLY — never persisted (federator, not a store). `maxEntries`
 * is small because there are only a handful of products per event.
 */
export class DamageCache extends VolatileTtlCache<DamageFeatureCollection> {
  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    super({
      ttlMs: options.ttlMs ?? 6 * 60 * 60 * 1000, // 6 hours
      maxEntries: options.maxEntries ?? 16,
    });
  }
}
