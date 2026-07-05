import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { extractMarkers, normalizeMarkers } from './parser.js';
import { fetchHtml } from '../../transports/scrape/client.js';

const RSC_URL = 'https://terremoto.hazlohoy.org/';

/**
 * Adapter for terremoto.hazlohoy.org. The site has no open JSON API: its map
 * markers are embedded in the Next.js RSC (`text/x-component`) payload served
 * when the page is requested with the `RSC: 1` header. This adapter fetches
 * that payload as text, extracts the `markers` array, and normalizes it.
 */
export class HazloHoyAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[HazloHoyAdapter] Fetching RSC payload for query: "${query}"`);

      const $ = await fetchHtml(RSC_URL, { headers: { RSC: '1' } });
      const raw = $.html();

      const markers = extractMarkers(raw);
      const results = normalizeMarkers(markers, query);

      console.log(`[HazloHoyAdapter] Extracted ${results.length} results for query: "${query}"`);

      return results;
    } catch (error) {
      console.error('[HazloHoyAdapter] Search failed:', error);
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
