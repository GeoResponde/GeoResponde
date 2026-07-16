import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { VolatileTtlCache } from '../../transports/cache.js';
import { parseCollectionCenters } from './parser.js';
import { AcopioVenezuelaAyudaItem } from './types.js';

export class AcopioVenezuelaAyudaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  private cache: VolatileTtlCache<NormalizedSearchResult[]>;
  private cacheKey = 'all-collection-centers';

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
    
    // @ts-expect-error metadata is not fully typed yet
    const metadata = providerConfig.metadata || {};
    // Configurable TTL from provider metadata, falling back to 5 minutes
    const ttlMs = metadata.cacheTtlMs 
      ? Number(metadata.cacheTtlMs) 
      : 5 * 60 * 1000;
      
    this.cache = new VolatileTtlCache({ ttlMs });
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      let allCenters = this.cache.get(this.cacheKey);
      
      if (allCenters) {
        console.log(`[AcopioVenezuelaAyudaAdapter] CACHE HIT: Retrieved ${allCenters.length} normalized items`);
      } else {
        console.log(`[AcopioVenezuelaAyudaAdapter] CACHE MISS: Fetching data from upstream`);
        const startTime = Date.now();
        
        // @ts-expect-error config is not fully typed yet
        const config = this.provider.config || {};
        const url = config.url;
        if (!url) {
          throw new Error('Missing URL in provider config');
        }

        const response = await fetchJson<AcopioVenezuelaAyudaItem[]>(url, { timeoutMs: 15000 });
        const fetchDuration = Date.now() - startTime;
        
        allCenters = parseCollectionCenters(this.provider.id, response);
        this.cache.set(this.cacheKey, allCenters);
        
        console.log(`[AcopioVenezuelaAyudaAdapter] Fetched and normalized ${allCenters.length} items in ${fetchDuration}ms`);
      }

      // Filter locally because sheet2api doesn't natively support free-text search across all fields efficiently
      const lowerQuery = query.toLowerCase().trim();
      if (!lowerQuery) {
        return allCenters;
      }

      return allCenters.filter(center => {
        return (
          center.title.toLowerCase().includes(lowerQuery) ||
          (center.subtitle && center.subtitle.toLowerCase().includes(lowerQuery))
        );
      });
    } catch (e) {
      // Fallback to stale cache if the rate-limited upstream is down
      const staleData = this.cache.getStale(this.cacheKey);
      if (staleData) {
        console.warn('[AcopioVenezuelaAyudaAdapter] Upstream fetch failed, falling back to stale cache');
        const lowerQuery = query.toLowerCase().trim();
        return lowerQuery ? staleData.filter(center => center.title.toLowerCase().includes(lowerQuery)) : staleData;
      }

      console.error('[AcopioVenezuelaAyudaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
