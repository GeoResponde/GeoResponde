import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { VolatileTtlCache } from '../../transports/cache.js';
import { parseCollectionCenters } from './parser.js';
import { CentrosDeAcopioVzlaRoot } from './types.js';

export class CentrosDeAcopioVzlaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  private cache: VolatileTtlCache<NormalizedSearchResult[]>;
  private cacheKey = 'centros-de-acopio-vzla-all';

  // The user requested `this.transport.getJson` so we provide a simple wrapper
  // around the shared transport layer.
  private transport = {
    getJson: fetchJson
  };

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
        console.log(`[CentrosDeAcopioVzlaAdapter] CACHE HIT: Retrieved ${allCenters.length} normalized items`);
      } else {
        console.log(`[CentrosDeAcopioVzlaAdapter] CACHE MISS: Fetching data from upstream`);
        const startTime = Date.now();
        
        // @ts-expect-error config is not fully typed yet
        const config = this.provider.config || {};
        const url = config.url;
        if (!url) {
          throw new Error('Missing URL in provider config');
        }

        const response = await this.transport.getJson<CentrosDeAcopioVzlaRoot>(url, { timeoutMs: 15000 });
        const fetchDuration = Date.now() - startTime;
        
        allCenters = parseCollectionCenters(this.provider.id, response);
        this.cache.set(this.cacheKey, allCenters);
        
        console.log(`[CentrosDeAcopioVzlaAdapter] Fetched and normalized ${allCenters.length} items in ${fetchDuration}ms`);
      }

      const lowerQuery = query.toLowerCase().trim();
      if (!lowerQuery) {
        return allCenters;
      }

      return allCenters.filter(center => {
        return (
          center.title.toLowerCase().includes(lowerQuery) ||
          (center.subtitle && center.subtitle.toLowerCase().includes(lowerQuery)) ||
          (center.metadata?.address && center.metadata.address.toLowerCase().includes(lowerQuery)) ||
          (center.metadata?.tags && center.metadata.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)))
        );
      });
    } catch (e) {
      const staleData = this.cache.getStale(this.cacheKey);
      if (staleData) {
        console.warn('[CentrosDeAcopioVzlaAdapter] Upstream fetch failed, falling back to stale cache', e);
        const lowerQuery = query.toLowerCase().trim();
        return lowerQuery ? staleData.filter(center => center.title.toLowerCase().includes(lowerQuery)) : staleData;
      }

      console.error('[CentrosDeAcopioVzlaAdapter] Search failed (network/transport error)', e);
      return [];
    }
  }

  /**
   * Submission is intentionally not implemented for this provider.
   * The upstream does not support automated ingestion of structured reports
   * through this endpoint.
   */
  async submit(_report: Report, _opts?: SubmitOptions): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
