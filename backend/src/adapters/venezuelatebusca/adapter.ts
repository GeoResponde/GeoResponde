import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchRemixSingleFetch } from '../../transports/remix/client.js';
import { parseVenezuelaTeBuscaStructural } from './parser.js';

export class VenezuelaTeBuscaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[VenezuelaTeBuscaAdapter] Fetching data`);
      
      const deserializedData = await fetchRemixSingleFetch(
        'https://venezuelatebusca.com', 
        'root', 
        { query },
        10000 // 10 second timeout
      );

      const normalizedResults = parseVenezuelaTeBuscaStructural(deserializedData);

      console.log(`[VenezuelaTeBuscaAdapter] Extracted ${normalizedResults.length} normalized results`);

      return normalizedResults;
    } catch {
      console.error('[VenezuelaTeBuscaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
