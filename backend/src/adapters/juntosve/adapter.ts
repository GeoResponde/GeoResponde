import type { BaseAdapter } from '../BaseAdapter.js';
import type { HumanitarianProvider, NormalizedSearchResult } from '@georesponde/shared';
import { fetchPostgrestGeoJson } from '../../transports/rest/client.js';
import type { JuntosVeFeature } from './types.js';
import { parseJuntosVeResponse } from './parser.js';

export class JuntosVeAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query?: string): Promise<NormalizedSearchResult[]> {
    // @ts-expect-error config is dynamically injected by the catalog
    const config = this.provider.config as { url?: string; apikey?: string } | undefined;
    
    if (!config?.url || !config?.apikey) {
      console.warn('[JuntosVeAdapter] Missing url or apikey in JuntosVE provider config');
      return [];
    }

    try {
      const data = await fetchPostgrestGeoJson<JuntosVeFeature>(config.url, {
        headers: {
          apikey: config.apikey,
          Authorization: `Bearer ${config.apikey}`,
        }
      });

      const normalized: NormalizedSearchResult[] = [];
      for (const feature of data.features) {
        if (!feature.geometry || !feature.geometry.coordinates) continue; 
        normalized.push(parseJuntosVeResponse(feature, this.provider.id));
      }

      console.log(`[JuntosVeAdapter] Extracted ${normalized.length} normalized results from JuntosVE`);
      return normalized;
    } catch (error) {
      console.error(`[JuntosVeAdapter] Search failed:`, error);
      return [];
    }
  }

  async submit(data: any): Promise<any> {
    throw new Error('JuntosVE does not support submission via GeoResponde.');
  }
}
