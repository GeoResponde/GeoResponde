import { BaseAdapter } from '../BaseAdapter.js';
import { HumanitarianProvider, NormalizedSearchResult, Report, SubmissionResult } from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { parseHdxResponse, HdxResponse } from './parser.js';

const HDX_API = 'https://data.humdata.org/api/3/action/package_search';

/**
 * Adapter for the Humanitarian Data Exchange (HDX), OCHA's open humanitarian
 * data platform. Uses the public keyless CKAN API (no scraping) to federate
 * humanitarian datasets into the Find module.
 */
export class HdxAdapter implements BaseAdapter {
  provider: HumanitarianProvider;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  private buildUrl(query: string): string {
    const url = new URL(HDX_API);
    url.searchParams.set('q', query);
    url.searchParams.set('rows', '10');
    return url.toString();
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      console.log(`[HdxAdapter] Fetching datasets`);
      const data = await fetchJson<HdxResponse>(this.buildUrl(query), { timeoutMs: 10000 });
      const results = parseHdxResponse(data);
      console.log(`[HdxAdapter] Extracted ${results.length} results`);
      return results;
    } catch {
      console.error('[HdxAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  async submit(_report: Report): Promise<SubmissionResult> {
    return { provider: this.provider.id, mode: 'dry-run', status: 'skipped' };
  }
}
