import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchHtml } from '../../transports/scrape/client.js';
import { parseReencuentraHtml } from './parser.js';

const BUSCAR_URL = 'https://reencuentra-ve.vercel.app/buscar?q=';

/**
 * Adapter for Reencuentra Venezuela (https://reencuentra-ve.vercel.app/).
 *
 * The provider exposes no public JSON API (its Supabase backend is closed), so
 * this adapter federates results by scraping the server-rendered HTML of the
 * public `/buscar` page.
 *
 * Caveat: `/buscar` renders at most 20 cards and real pagination is served
 * through a Next.js Server Action that is not present in the static HTML. This
 * adapter therefore federates only the first page of results.
 */
export class ReencuentraVeAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      const url = BUSCAR_URL + encodeURIComponent(query);
      // fetchHtml returns a loaded Cheerio instance; re-serialize to a raw HTML
      // string so the pure parser can own all of the DOM traversal.
      const $ = await fetchHtml(url);
      const html = $.html();
      const results = parseReencuentraHtml(html);

      console.log(`[ReencuentraVeAdapter] Extracted ${results.length} results`);
      return results;
    } catch {
      console.error('[ReencuentraVeAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
