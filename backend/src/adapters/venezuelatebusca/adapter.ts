import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, SubmissionPackage } from '@georesponde/shared';
import { fetchRemixSingleFetch } from '../../transports/remix/client.js';
import { deserializeTurboStream } from '../../transports/remix/deserializer.js';
import { parseVenezuelaTeBuscaStructural } from './parser.js';

export class VenezuelaTeBuscaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[VenezuelaTeBuscaAdapter] Fetching data for query: "${query}"`);
      
      const stream = await fetchRemixSingleFetch(
        'https://venezuelatebusca.com', 
        'root', 
        { query },
        10000 // 10 second timeout
      );

      const deserializedData = await deserializeTurboStream(stream);
      const normalizedResults = parseVenezuelaTeBuscaStructural(deserializedData);

      console.log(`[VenezuelaTeBuscaAdapter] Extracted ${normalizedResults.length} normalized results for query: "${query}"`);

      return normalizedResults;
    } catch (error) {
      console.error('[VenezuelaTeBuscaAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(pkg: SubmissionPackage): Promise<{ success: boolean; referenceId?: string }> {
    console.warn(`[VenezuelaTeBuscaAdapter] Submit not implemented for this provider`);
    return { success: false };
  }
}
